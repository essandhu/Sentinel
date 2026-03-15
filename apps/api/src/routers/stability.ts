import { z } from 'zod';
import { eq, and, gte, asc } from 'drizzle-orm';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb, diffReports, snapshots, captureRuns, type Db } from '@sentinel/db';
import { countFlips, computeStabilityScore } from '../services/stability-score-service.js';

function getDb() {
  return createDb(process.env.DATABASE_URL!);
}

/** List stability scores for all routes in a project (exported for unit testing) */
export async function listHandler(db: Db, projectId: string, windowDays: number = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const rows = await db
    .select({
      url: snapshots.url,
      viewport: snapshots.viewport,
      browser: snapshots.browser,
      parameterName: snapshots.parameterName,
      passed: diffReports.passed,
      createdAt: diffReports.createdAt,
    })
    .from(diffReports)
    .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .where(
      and(
        eq(captureRuns.projectId, projectId),
        gte(diffReports.createdAt, cutoff),
      ),
    )
    .orderBy(asc(diffReports.createdAt));

  if (rows.length === 0) return [];

  // Group by route key
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.url}|${row.viewport}|${row.browser}|${row.parameterName}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const results: Array<{
    url: string;
    viewport: string;
    browser: string;
    parameterName: string;
    stabilityScore: number;
    flipCount: number;
    totalRuns: number;
  }> = [];

  for (const [_key, group] of groups) {
    const flipCount = countFlips(group);
    results.push({
      url: group[0].url,
      viewport: group[0].viewport,
      browser: group[0].browser,
      parameterName: group[0].parameterName,
      stabilityScore: computeStabilityScore(flipCount),
      flipCount,
      totalRuns: group.length,
    });
  }

  // Sort by stability score ASC (worst first)
  results.sort((a, b) => a.stabilityScore - b.stabilityScore);
  return results;
}

/** Get flip history for a single route (exported for unit testing) */
export async function flipHistoryHandler(
  db: Db,
  projectId: string,
  url: string,
  viewport: string,
  browser: string,
  parameterName: string,
  windowDays: number = 30,
) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  return db
    .select({
      passed: diffReports.passed,
      createdAt: diffReports.createdAt,
    })
    .from(diffReports)
    .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .where(
      and(
        eq(captureRuns.projectId, projectId),
        eq(snapshots.url, url),
        eq(snapshots.viewport, viewport),
        eq(snapshots.browser, browser),
        eq(snapshots.parameterName, parameterName),
        gte(diffReports.createdAt, cutoff),
      ),
    )
    .orderBy(asc(diffReports.createdAt));
}

export const stabilityRouter = t.router({
  list: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => listHandler(getDb(), input.projectId)),

  flipHistory: workspaceProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      url: z.string(),
      viewport: z.string(),
      browser: z.string(),
      parameterName: z.string(),
    }))
    .query(async ({ input }) =>
      flipHistoryHandler(
        getDb(),
        input.projectId,
        input.url,
        input.viewport,
        input.browser,
        input.parameterName,
      ),
    ),
});
