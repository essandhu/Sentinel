import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, desc } from 'drizzle-orm';
import { t, reviewerProcedure, workspaceProcedure } from '../trpc.js';
import {
  createDb,
  diffReports,
  snapshots,
  captureRuns,
  projects,
  baselines,
  approvalDecisions,
  workspaceSettings,
} from '@sentinel/db';
import { decrypt } from '../services/crypto.js';
import { createJiraIssue, attachToJiraIssue } from '../services/jira-service.js';
import { isNotificationEnabled } from '../services/notification-preferences.js';
import { createStorageClient, downloadBuffer } from '@sentinel/storage';
import { wsManager } from '../ws/websocket-manager.js';
import {
  getChainForProject,
  validateAndRecordApproval,
  maybePromoteBaseline,
} from '../services/approval-chain-service.js';
import { loadAllPlugins, PluginHookRunner, loadConfig } from '@sentinel/capture';

const db = createDb();

/** Fire onApproval plugin hook (best-effort, never blocks approval flow) */
async function fireOnApprovalHook(
  diffReportId: string,
  action: 'approved' | 'rejected' | 'deferred',
  userId: string,
  reason?: string,
): Promise<void> {
  try {
    const config = await loadConfig(process.cwd());
    const plugins = await loadAllPlugins(process.cwd(), config.plugins ?? {});
    if (plugins.length > 0) {
      const hookRunner = new PluginHookRunner(plugins);
      await hookRunner.onApproval({ diffReportId, action, userId, reason });
    }
  } catch (err) {
    console.error('[plugins] onApproval hook error:', err);
  }
}

/**
 * Verify a diff belongs to the caller's workspace.
 * Returns the diff + snapshot details needed for baseline insertion.
 */
async function verifyDiffOwnership(diffReportId: string, workspaceId: string | undefined) {
  const rows = await db
    .select({
      diffId: diffReports.id,
      snapshotId: snapshots.id,
      url: snapshots.url,
      viewport: snapshots.viewport,
      browser: snapshots.browser,
      s3Key: snapshots.s3Key,
      parameterName: snapshots.parameterName,
      diffS3Key: diffReports.diffS3Key,
      projectId: projects.id,
      branchName: captureRuns.branchName,
    })
    .from(diffReports)
    .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .innerJoin(projects, eq(captureRuns.projectId, projects.id))
    .where(
      workspaceId
        ? and(eq(diffReports.id, diffReportId), eq(projects.workspaceId, workspaceId))
        : eq(diffReports.id, diffReportId),
    );

  if (rows.length === 0) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Diff report not found in workspace' });
  }
  return rows[0];
}

export const approvalsRouter = t.router({
  approve: reviewerProcedure
    .input(z.object({
      diffReportId: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const diff = await verifyDiffOwnership(input.diffReportId, (ctx as any).workspaceId);
      const userId = (ctx as any).auth?.userId ?? 'anonymous';
      const userEmail = (ctx as any).auth?.sessionClaims?.email ?? 'unknown';
      const orgRole = (ctx as any).orgRole ?? 'org:member';

      // Check if project has an approval chain
      const chain = await getChainForProject(db, diff.projectId);

      if (chain.length > 0) {
        // Chain-aware approval: record step, promote only when complete
        const result = await validateAndRecordApproval(
          db, input.diffReportId, diff.projectId, userId, userEmail, orgRole,
        );

        if (result.error) {
          throw new TRPCError({ code: 'FORBIDDEN', message: result.error });
        }

        // Insert audit decision
        await db.insert(approvalDecisions).values({
          diffReportId: input.diffReportId,
          action: 'approved',
          userId,
          userEmail,
          reason: input.reason ?? null,
        });

        // Promote baseline if chain is now complete
        if (result.chainComplete) {
          await maybePromoteBaseline(db, input.diffReportId, diff.projectId, {
            projectId: diff.projectId,
            url: diff.url,
            viewport: diff.viewport,
            browser: diff.browser,
            parameterName: diff.parameterName,
            branchName: diff.branchName ?? 'main',
            s3Key: diff.s3Key,
            snapshotId: diff.snapshotId,
          });
        }
      } else {
        // Legacy path: immediate baseline promotion (no chain)
        await db.insert(baselines).values({
          projectId: diff.projectId,
          url: diff.url,
          viewport: diff.viewport,
          browser: diff.browser,
          branchName: diff.branchName ?? 'main',
          s3Key: diff.s3Key,
          snapshotId: diff.snapshotId,
          approvedBy: userId,
        });

        // Insert audit decision
        await db.insert(approvalDecisions).values({
          diffReportId: input.diffReportId,
          action: 'approved',
          userId,
          userEmail,
          reason: input.reason ?? null,
        });
      }

      // Best-effort WebSocket notification (never blocks approval flow)
      try {
        wsManager.broadcast((ctx as any).workspaceId ?? 'default', {
          type: 'approval:created',
          payload: {
            diffReportId: input.diffReportId,
            action: 'approved',
            userId,
            userEmail,
          },
        });
      } catch {
        // WebSocket failure must never block approval
      }

      // Plugin onApproval hook (best-effort)
      await fireOnApprovalHook(input.diffReportId, 'approved', userId, input.reason);

      return { success: true };
    }),

  reject: reviewerProcedure
    .input(z.object({
      diffReportId: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const diff = await verifyDiffOwnership(input.diffReportId, (ctx as any).workspaceId);
      const userId = (ctx as any).auth?.userId ?? 'anonymous';
      const userEmail = (ctx as any).auth?.sessionClaims?.email ?? 'unknown';

      // Reject: audit row only, NO baseline insertion
      const [inserted] = await db.insert(approvalDecisions).values({
        diffReportId: input.diffReportId,
        action: 'rejected',
        userId,
        userEmail,
        reason: input.reason ?? null,
      }).returning({ id: approvalDecisions.id });

      // Best-effort WebSocket notification (never blocks rejection flow)
      try {
        wsManager.broadcast((ctx as any).workspaceId ?? 'default', {
          type: 'approval:created',
          payload: {
            diffReportId: input.diffReportId,
            action: 'rejected',
            userId,
            userEmail,
          },
        });
      } catch {
        // WebSocket failure must never block rejection
      }

      // Best-effort Jira issue creation with diff image attachment
      try {
        const workspaceId = (ctx as any).workspaceId ?? 'default';

        const jiraEnabled = await isNotificationEnabled(db, workspaceId, 'rejection_created', 'jira');
        if (!jiraEnabled) {
          // Jira notifications disabled for this workspace — skip issue creation
          return { success: true };
        }

        const [settings] = await db
          .select()
          .from(workspaceSettings)
          .where(eq(workspaceSettings.workspaceId, workspaceId));

        if (settings?.jiraHost && settings?.jiraApiToken) {
          const jiraConfig = {
            host: settings.jiraHost,
            email: settings.jiraEmail ?? '',
            apiToken: decrypt(settings.jiraApiToken),
            projectKey: settings.jiraProjectKey ?? 'SEN',
          };

          const issueKey = await createJiraIssue(jiraConfig, {
            summary: `Visual regression: ${diff.url} (${diff.viewport})`,
            description: `Visual regression detected for ${diff.url} at viewport ${diff.viewport}. Review in Sentinel dashboard.`,
          });

          // Download diff image from S3 and attach to the Jira issue
          const storageClient = createStorageClient({
            endpoint: process.env.S3_ENDPOINT,
            region: process.env.S3_REGION ?? 'us-east-1',
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY!,
              secretAccessKey: process.env.S3_SECRET_KEY!,
            },
          });
          const buffer = await downloadBuffer(
            storageClient,
            process.env.S3_BUCKET!,
            diff.diffS3Key,
          );
          await attachToJiraIssue(jiraConfig, issueKey, 'diff.png', buffer);

          // Store issue key on the decision row
          await db
            .update(approvalDecisions)
            .set({ jiraIssueKey: issueKey })
            .where(eq(approvalDecisions.id, inserted.id));
        }
      } catch (err) {
        console.error('[jira] Failed to create issue or attach diff:', err);
      }

      // Plugin onApproval hook (best-effort)
      await fireOnApprovalHook(input.diffReportId, 'rejected', userId, input.reason);

      return { success: true };
    }),

  defer: reviewerProcedure
    .input(z.object({
      diffReportId: z.string().uuid(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyDiffOwnership(input.diffReportId, (ctx as any).workspaceId);
      const userId = (ctx as any).auth?.userId ?? 'anonymous';
      const userEmail = (ctx as any).auth?.sessionClaims?.email ?? 'unknown';

      await db.insert(approvalDecisions).values({
        diffReportId: input.diffReportId,
        action: 'deferred',
        userId,
        userEmail,
        reason: input.reason,
      });

      // Plugin onApproval hook (best-effort)
      await fireOnApprovalHook(input.diffReportId, 'deferred', userId, input.reason);

      return { success: true };
    }),

  bulkApprove: reviewerProcedure
    .input(z.object({
      runId: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = (ctx as any).workspaceId;
      const userId = (ctx as any).auth?.userId ?? 'anonymous';
      const userEmail = (ctx as any).auth?.sessionClaims?.email ?? 'unknown';
      const orgRole = (ctx as any).orgRole ?? 'org:member';

      // Find all failed diffs in the run belonging to caller's workspace
      const failedDiffs = await db
        .select({
          diffId: diffReports.id,
          snapshotId: snapshots.id,
          url: snapshots.url,
          viewport: snapshots.viewport,
          browser: snapshots.browser,
          s3Key: snapshots.s3Key,
          parameterName: snapshots.parameterName,
          projectId: projects.id,
          branchName: captureRuns.branchName,
        })
        .from(diffReports)
        .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
        .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
        .innerJoin(projects, eq(captureRuns.projectId, projects.id))
        .where(
          workspaceId
            ? and(
                eq(captureRuns.id, input.runId),
                eq(diffReports.passed, 'false'),
                eq(projects.workspaceId, workspaceId),
              )
            : and(eq(captureRuns.id, input.runId), eq(diffReports.passed, 'false')),
        );

      await db.transaction(async (tx: any) => {
        for (const diff of failedDiffs) {
          const chain = await getChainForProject(tx, diff.projectId);

          if (chain.length > 0) {
            // Chain-aware: advance one step per diff
            const result = await validateAndRecordApproval(
              tx, diff.diffId, diff.projectId, userId, userEmail, orgRole,
            );

            // Insert audit decision regardless
            await tx.insert(approvalDecisions).values({
              diffReportId: diff.diffId,
              action: 'approved',
              userId,
              userEmail,
              reason: input.reason ?? null,
            });

            // Promote baseline only when chain is complete
            if (result.chainComplete) {
              await maybePromoteBaseline(tx, diff.diffId, diff.projectId, {
                projectId: diff.projectId,
                url: diff.url,
                viewport: diff.viewport,
                browser: diff.browser,
                parameterName: diff.parameterName,
                branchName: diff.branchName ?? 'main',
                s3Key: diff.s3Key,
                snapshotId: diff.snapshotId,
              });
            }
          } else {
            // Legacy path: immediate baseline
            await tx.insert(baselines).values({
              projectId: diff.projectId,
              url: diff.url,
              viewport: diff.viewport,
              browser: diff.browser,
              branchName: diff.branchName ?? 'main',
              s3Key: diff.s3Key,
              snapshotId: diff.snapshotId,
              approvedBy: userId,
            });

            await tx.insert(approvalDecisions).values({
              diffReportId: diff.diffId,
              action: 'approved',
              userId,
              userEmail,
              reason: input.reason ?? null,
            });
          }
        }
      });

      // Best-effort WebSocket notification (never blocks bulk approval flow)
      try {
        wsManager.broadcast(workspaceId ?? 'default', {
          type: 'approval:bulkApproved',
          payload: {
            runId: input.runId,
            approvedCount: failedDiffs.length,
            userId,
            userEmail,
          },
        });
      } catch {
        // WebSocket failure must never block bulk approval
      }

      return { approvedCount: failedDiffs.length };
    }),

  history: workspaceProcedure
    .input(z.object({
      diffReportId: z.string().uuid().optional(),
      runId: z.string().uuid().optional(),
      action: z.enum(['approved', 'rejected', 'deferred']).optional(),
      userId: z.string().optional(),
    }).refine((data) => data.diffReportId || data.runId, {
      message: 'At least one of diffReportId or runId is required',
    }))
    .query(async ({ ctx, input }) => {
      if (input.diffReportId) {
        // Simple case: filter by diffReportId
        const rows = await db
          .select({
            id: approvalDecisions.id,
            diffReportId: approvalDecisions.diffReportId,
            action: approvalDecisions.action,
            userId: approvalDecisions.userId,
            userEmail: approvalDecisions.userEmail,
            reason: approvalDecisions.reason,
            jiraIssueKey: approvalDecisions.jiraIssueKey,
            createdAt: approvalDecisions.createdAt,
          })
          .from(approvalDecisions)
          .where(eq(approvalDecisions.diffReportId, input.diffReportId))
          .orderBy(desc(approvalDecisions.createdAt));
        return rows;
      }

      // runId case: join through diffReports -> snapshots to filter by run
      const rows = await db
        .select({
          id: approvalDecisions.id,
          diffReportId: approvalDecisions.diffReportId,
          action: approvalDecisions.action,
          userId: approvalDecisions.userId,
          userEmail: approvalDecisions.userEmail,
          reason: approvalDecisions.reason,
          jiraIssueKey: approvalDecisions.jiraIssueKey,
          createdAt: approvalDecisions.createdAt,
        })
        .from(approvalDecisions)
        .innerJoin(diffReports, eq(approvalDecisions.diffReportId, diffReports.id))
        .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
        .where(eq(snapshots.runId, input.runId!))
        .orderBy(desc(approvalDecisions.createdAt));
      return rows;
    }),
});
