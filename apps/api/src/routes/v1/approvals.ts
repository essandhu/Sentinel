import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import {
  createDb,
  diffReports,
  snapshots,
  captureRuns,
  projects,
  baselines,
  approvalDecisions,
} from '@sentinel/db';
import {
  getChainForProject,
  validateAndRecordApproval,
  maybePromoteBaseline,
} from '../../services/approval-chain-service.js';

const db = createDb(process.env.DATABASE_URL!);

/**
 * Verify a diff belongs to the caller's workspace.
 * Returns the diff + snapshot details needed for baseline insertion.
 */
async function verifyDiffOwnership(diffReportId: string, workspaceId: string) {
  const rows = await db
    .select({
      diffId: diffReports.id,
      snapshotId: snapshots.id,
      url: snapshots.url,
      viewport: snapshots.viewport,
      browser: snapshots.browser,
      s3Key: snapshots.s3Key,
      parameterName: snapshots.parameterName,
      projectId: projects.id,
    })
    .from(diffReports)
    .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .innerJoin(projects, eq(captureRuns.projectId, projects.id))
    .where(and(eq(diffReports.id, diffReportId), eq(projects.workspaceId, workspaceId)));

  return rows[0] ?? null;
}

const approveSchema = {
  tags: ['Approvals'],
  summary: 'Approve a diff report',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
    required: ['id'] as const,
  },
  body: {
    type: 'object' as const,
    properties: {
      reason: { type: 'string' as const },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
    401: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
    404: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
  },
};

const rejectSchema = {
  tags: ['Approvals'],
  summary: 'Reject a diff report',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
    required: ['id'] as const,
  },
  body: {
    type: 'object' as const,
    properties: {
      reason: { type: 'string' as const },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
    401: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
    404: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
  },
};

export function registerApprovalRoutes(app: FastifyInstance): void {
  app.post('/diffs/:id/approve', { schema: approveSchema }, async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = (req as any).workspaceId;
    const { id } = req.params as { id: string };
    const { reason } = (req.body as { reason?: string }) || {};

    const diff = await verifyDiffOwnership(id, workspaceId);
    if (!diff) {
      return reply.code(404).send({ error: 'Diff report not found' });
    }

    // Check if project has an approval chain
    const chain = await getChainForProject(db, diff.projectId);

    if (chain.length > 0) {
      // Chain-aware approval via REST API key
      const result = await validateAndRecordApproval(
        db, id, diff.projectId, 'api-key', 'api-key', 'api-key',
      );

      if (result.error) {
        return reply.code(403).send({ error: result.error });
      }

      // Insert audit decision
      await db.insert(approvalDecisions).values({
        diffReportId: id,
        action: 'approved',
        userId: 'api-key',
        userEmail: 'api-key',
        reason: reason ?? null,
      });

      // Promote baseline if chain is now complete
      if (result.chainComplete) {
        await maybePromoteBaseline(db, id, diff.projectId, {
          projectId: diff.projectId,
          url: diff.url,
          viewport: diff.viewport,
          browser: diff.browser,
          parameterName: diff.parameterName,
          s3Key: diff.s3Key,
          snapshotId: diff.snapshotId,
        });
      }
    } else {
      // Legacy path: immediate baseline promotion
      await db.insert(baselines).values({
        projectId: diff.projectId,
        url: diff.url,
        viewport: diff.viewport,
        browser: diff.browser,
        s3Key: diff.s3Key,
        snapshotId: diff.snapshotId,
        approvedBy: 'api-key',
      });

      // Insert audit decision
      await db.insert(approvalDecisions).values({
        diffReportId: id,
        action: 'approved',
        userId: 'api-key',
        userEmail: 'api-key',
        reason: reason ?? null,
      });
    }

    return { success: true };
  });

  app.post('/diffs/:id/reject', { schema: rejectSchema }, async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = (req as any).workspaceId;
    const { id } = req.params as { id: string };
    const { reason } = (req.body as { reason?: string }) || {};

    const diff = await verifyDiffOwnership(id, workspaceId);
    if (!diff) {
      return reply.code(404).send({ error: 'Diff report not found' });
    }

    // Reject: audit row only, NO baseline insertion, NO Jira integration
    await db.insert(approvalDecisions).values({
      diffReportId: id,
      action: 'rejected',
      userId: 'api-key',
      userEmail: 'api-key',
      reason: reason ?? null,
    });

    return { success: true };
  });
}
