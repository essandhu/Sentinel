import { eq, and, desc } from 'drizzle-orm';
import { baselines } from '@sentinel-vrt/db';
import type { Db } from '@sentinel-vrt/db';

export interface LookupBaselineOpts {
  projectId: string;
  url: string;
  viewport: string;
  browser: string;
  parameterName: string;
  branchName: string;
  parentBranch?: string;
}

/**
 * Centralized branch-aware baseline lookup with parent-branch inheritance.
 *
 * Step 1: Query baselines matching the given branchName.
 * Step 2: If no result and branchName !== parentBranch (default 'main'),
 *         repeat query with parentBranch for inheritance.
 *
 * Returns { s3Key } or null if no baseline exists.
 */
export async function lookupBaseline(
  db: Db,
  opts: LookupBaselineOpts,
): Promise<{ s3Key: string } | null> {
  const { projectId, url, viewport, browser, parameterName, branchName } = opts;
  const parentBranch = opts.parentBranch ?? 'main';

  // Step 1: Look for branch-specific baseline
  const branchResult = await db
    .select({ s3Key: baselines.s3Key })
    .from(baselines)
    .where(and(
      eq(baselines.projectId, projectId),
      eq(baselines.url, url),
      eq(baselines.viewport, viewport),
      eq(baselines.browser, browser),
      eq(baselines.parameterName, parameterName),
      eq(baselines.branchName, branchName),
    ))
    .orderBy(desc(baselines.createdAt))
    .limit(1);

  if (branchResult.length > 0) {
    return { s3Key: branchResult[0].s3Key };
  }

  // Step 2: Fall back to parent branch if different
  if (branchName !== parentBranch) {
    const fallbackResult = await db
      .select({ s3Key: baselines.s3Key })
      .from(baselines)
      .where(and(
        eq(baselines.projectId, projectId),
        eq(baselines.url, url),
        eq(baselines.viewport, viewport),
        eq(baselines.browser, browser),
        eq(baselines.parameterName, parameterName),
        eq(baselines.branchName, parentBranch),
      ))
      .orderBy(desc(baselines.createdAt))
      .limit(1);

    if (fallbackResult.length > 0) {
      return { s3Key: fallbackResult[0].s3Key };
    }
  }

  return null;
}
