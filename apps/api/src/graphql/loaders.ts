import { inArray, eq, and, desc, isNull, count } from 'drizzle-orm';
import {
  createDb,
  captureRuns,
  snapshots,
  diffReports,
  components,
  healthScores,
  projects,
  a11yViolations,
  diffClassifications,
  diffRegions,
  type Db,
} from '@sentinel/db';
import type { GqlContext } from './resolvers.js';
import { getViolationsByRunId } from '../services/a11y-service.js';
import { getClassificationsByDiffReportIds } from '../services/classification-service.js';

function getDb(ctx: GqlContext): Db {
  return ctx.db;
}

export const loaders = {
  Project: {
    captureRuns: async (
      queries: Array<{ obj: { id: string }; params: Record<string, never> }>,
      ctx: GqlContext,
    ) => {
      const db = getDb(ctx);
      const projectIds = queries.map((q) => q.obj.id);

      const rows = await db
        .select({
          id: captureRuns.id,
          projectId: captureRuns.projectId,
          branchName: captureRuns.branchName,
          commitSha: captureRuns.commitSha,
          status: captureRuns.status,
          createdAt: captureRuns.createdAt,
          completedAt: captureRuns.completedAt,
          totalDiffs: count(diffReports.id),
        })
        .from(captureRuns)
        .leftJoin(snapshots, eq(snapshots.runId, captureRuns.id))
        .leftJoin(diffReports, eq(diffReports.snapshotId, snapshots.id))
        .where(inArray(captureRuns.projectId, projectIds))
        .groupBy(captureRuns.id)
        .orderBy(desc(captureRuns.createdAt));

      const byProjectId = new Map<string, typeof rows>();
      for (const row of rows) {
        const pid = row.projectId;
        if (!byProjectId.has(pid)) byProjectId.set(pid, []);
        byProjectId.get(pid)!.push(row);
      }

      return queries.map((q) => byProjectId.get(q.obj.id) ?? []);
    },

    components: async (
      queries: Array<{ obj: { id: string }; params: Record<string, never> }>,
      ctx: GqlContext,
    ) => {
      const db = getDb(ctx);
      const projectIds = queries.map((q) => q.obj.id);

      const rows = await db
        .select()
        .from(components)
        .where(inArray(components.projectId, projectIds));

      const byProjectId = new Map<string, typeof rows>();
      for (const row of rows) {
        const pid = row.projectId;
        if (!byProjectId.has(pid)) byProjectId.set(pid, []);
        byProjectId.get(pid)!.push(row);
      }

      return queries.map((q) => byProjectId.get(q.obj.id) ?? []);
    },

    healthScore: async (
      queries: Array<{ obj: { id: string }; params: Record<string, never> }>,
      ctx: GqlContext,
    ) => {
      const db = getDb(ctx);
      const projectIds = queries.map((q) => q.obj.id);

      const rows = await db
        .select({
          projectId: healthScores.projectId,
          score: healthScores.score,
          computedAt: healthScores.computedAt,
        })
        .from(healthScores)
        .where(
          and(
            inArray(healthScores.projectId, projectIds),
            isNull(healthScores.componentId),
          ),
        )
        .orderBy(desc(healthScores.computedAt));

      // Keep only the latest score per project
      const byProjectId = new Map<string, { score: number; computedAt: Date }>();
      for (const row of rows) {
        if (!byProjectId.has(row.projectId)) {
          byProjectId.set(row.projectId, {
            score: row.score,
            computedAt: row.computedAt,
          });
        }
      }

      return queries.map((q) => byProjectId.get(q.obj.id) ?? null);
    },
  },

  CaptureRun: {
    diffs: async (
      queries: Array<{ obj: { id: string }; params: Record<string, never> }>,
      ctx: GqlContext,
    ) => {
      const db = getDb(ctx);
      const runIds = queries.map((q) => q.obj.id);

      const rows = await db
        .select({
          id: diffReports.id,
          snapshotId: diffReports.snapshotId,
          snapshotUrl: snapshots.url,
          snapshotViewport: snapshots.viewport,
          browser: snapshots.browser,
          baselineS3Key: diffReports.baselineS3Key,
          diffS3Key: diffReports.diffS3Key,
          pixelDiffPercent: diffReports.pixelDiffPercent,
          ssimScore: diffReports.ssimScore,
          passed: diffReports.passed,
          createdAt: diffReports.createdAt,
          runId: snapshots.runId,
        })
        .from(diffReports)
        .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
        .where(inArray(snapshots.runId, runIds));

      const byRunId = new Map<string, Array<(typeof rows)[number]>>();
      for (const row of rows) {
        const rid = row.runId;
        if (!byRunId.has(rid)) byRunId.set(rid, []);
        byRunId.get(rid)!.push(row);
      }

      return queries.map((q) => byRunId.get(q.obj.id) ?? []);
    },

    a11ySummary: async (
      queries: Array<{ obj: { id: string }; params: Record<string, never> }>,
      ctx: GqlContext,
    ) => {
      const db = getDb(ctx);
      const runIds = queries.map((q) => q.obj.id);

      // Each run needs its own getViolationsByRunId call (complex multi-step query)
      const resultsByRunId = new Map<string, Awaited<ReturnType<typeof getViolationsByRunId>>>();
      await Promise.all(
        runIds.map(async (runId) => {
          try {
            const result = await getViolationsByRunId(db, runId);
            resultsByRunId.set(runId, result);
          } catch {
            // If a11y data doesn't exist for this run, return null
          }
        }),
      );

      return queries.map((q) => resultsByRunId.get(q.obj.id) ?? null);
    },
  },

  DiffReport: {
    classification: async (
      queries: Array<{ obj: { id: string }; params: Record<string, never> }>,
      ctx: GqlContext,
    ) => {
      const db = getDb(ctx);
      const diffReportIds = queries.map((q) => q.obj.id);

      const resultMap = await getClassificationsByDiffReportIds(db, diffReportIds);

      return queries.map((q) => resultMap.get(q.obj.id) ?? null);
    },
  },
};
