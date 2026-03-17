import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { t, adminProcedure, workspaceProcedure } from '../trpc.js';
import {
  createDb,
  approvalChainSteps,
  approvalChainProgress,
  diffReports,
  snapshots,
  captureRuns,
  type Db,
} from '@sentinel-vrt/db';
import {
  getChainForProject,
  getCurrentStep,
  isChainComplete,
} from '../services/approval-chain-service.js';

function getDb() {
  return createDb(process.env.DATABASE_URL!);
}

/** Upsert chain steps atomically (exported for unit testing) */
export async function upsertChainHandler(
  db: Db,
  projectId: string,
  steps: Array<{ stepOrder: number; label: string; requiredRole: string | null; requiredUserId: string | null }>,
) {
  await db.transaction(async (tx) => {
    // Delete existing chain steps for project
    await tx.delete(approvalChainSteps).where(eq(approvalChainSteps.projectId, projectId));
    // Insert new steps
    for (const step of steps) {
      await tx.insert(approvalChainSteps).values({
        projectId,
        stepOrder: step.stepOrder,
        label: step.label,
        requiredRole: step.requiredRole,
        requiredUserId: step.requiredUserId,
      });
    }
  });
  return { count: steps.length };
}

/** Get chain steps for a project (exported for unit testing) */
export async function getChainHandler(db: Db, projectId: string) {
  return getChainForProject(db, projectId);
}

/** Get progress for a diff (exported for unit testing) */
export async function getProgressHandler(db: Db, diffReportId: string) {
  // Look up project from diff
  const [diff] = await db
    .select({ projectId: captureRuns.projectId })
    .from(diffReports)
    .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .where(eq(diffReports.id, diffReportId))
    .limit(1);

  if (!diff) {
    return { chain: [], completed: [], currentStep: null, isComplete: true };
  }

  const chain = await getChainForProject(db, diff.projectId);
  const completed = await db
    .select({
      stepOrder: approvalChainProgress.stepOrder,
      userId: approvalChainProgress.userId,
      userEmail: approvalChainProgress.userEmail,
      completedAt: approvalChainProgress.completedAt,
    })
    .from(approvalChainProgress)
    .where(eq(approvalChainProgress.diffReportId, diffReportId))
    .orderBy(asc(approvalChainProgress.stepOrder));

  const currentStep = await getCurrentStep(db, diffReportId, diff.projectId);
  const complete = await isChainComplete(db, diffReportId, diff.projectId);

  return { chain, completed, currentStep, isComplete: complete };
}

export const approvalChainsRouter = t.router({
  upsertChain: adminProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      steps: z.array(z.object({
        stepOrder: z.number().int().positive(),
        label: z.string().min(1),
        requiredRole: z.string().nullable(),
        requiredUserId: z.string().nullable(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      return upsertChainHandler(db, input.projectId, input.steps);
    }),

  getChain: workspaceProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      return getChainHandler(db, input.projectId);
    }),

  getProgress: workspaceProcedure
    .input(z.object({
      diffReportId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      return getProgressHandler(db, input.diffReportId);
    }),

  getRunProgress: workspaceProcedure
    .input(z.object({
      runId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      // Get all diffs in run
      const diffs = await db
        .select({
          diffId: diffReports.id,
          projectId: captureRuns.projectId,
        })
        .from(diffReports)
        .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
        .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
        .where(eq(captureRuns.id, input.runId));

      const results: Array<{
        diffId: string;
        chain: Awaited<ReturnType<typeof getChainForProject>>;
        currentStep: Awaited<ReturnType<typeof getCurrentStep>>;
        isComplete: boolean;
      }> = [];

      for (const diff of diffs) {
        const chain = await getChainForProject(db, diff.projectId);
        if (chain.length === 0) continue; // Skip non-chain projects

        const currentStep = await getCurrentStep(db, diff.diffId, diff.projectId);
        const complete = await isChainComplete(db, diff.diffId, diff.projectId);
        results.push({
          diffId: diff.diffId,
          chain,
          currentStep,
          isComplete: complete,
        });
      }

      return results;
    }),
});
