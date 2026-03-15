import { eq, and, gte, asc } from 'drizzle-orm';
import {
  diffReports,
  snapshots,
  captureRuns,
} from '@sentinel/db';
import type { Db } from '@sentinel/db';

/**
 * Count the number of times a route's pass/fail status flips
 * in a chronologically ordered sequence of diff results.
 */
export function countFlips(results: Array<{ passed: boolean | string }>): number {
  if (results.length <= 1) return 0;
  let flips = 0;
  for (let i = 1; i < results.length; i++) {
    const prev = String(results[i - 1].passed) === 'true';
    const curr = String(results[i].passed) === 'true';
    if (prev !== curr) flips++;
  }
  return flips;
}

/**
 * Compute stability score from flip count.
 * Formula: max(0, 100 - flipCount * 10)
 * 0 flips = 100 (perfectly stable), 10+ flips = 0 (highly unstable)
 */
export function computeStabilityScore(flipCount: number): number {
  return Math.max(0, 100 - flipCount * 10);
}

/**
 * Get chronological diff results for a single route within a rolling window.
 */
export async function getFlipHistory(
  db: Db,
  projectId: string,
  url: string,
  viewport: string,
  browser: string,
  parameterName: string,
  windowDays: number = 30,
): Promise<Array<{ passed: string; createdAt: Date }>> {
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
