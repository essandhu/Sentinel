import { eq, and, desc, ne } from 'drizzle-orm';
import { a11yViolations, captureRuns, type Db } from '@sentinel-vrt/db';

/**
 * Get violations for a specific capture run, grouped by status (new/fixed/existing) with summary counts.
 * Pure function with Db as first parameter -- usable from tRPC routers, GraphQL resolvers, or REST handlers.
 */
export async function getViolationsByRunId(
  db: Db,
  runId: string,
): Promise<{
  summary: { new: number; fixed: number; existing: number };
  violations: Array<{
    id: string;
    ruleId: string;
    impact: string;
    cssSelector: string;
    html: string | null;
    helpUrl: string | null;
    isNew: number;
    fingerprint: string;
  }>;
}> {
  // Get all violations for this run
  const violations = await db
    .select({
      id: a11yViolations.id,
      ruleId: a11yViolations.ruleId,
      impact: a11yViolations.impact,
      cssSelector: a11yViolations.cssSelector,
      html: a11yViolations.html,
      helpUrl: a11yViolations.helpUrl,
      isNew: a11yViolations.isNew,
      fingerprint: a11yViolations.fingerprint,
    })
    .from(a11yViolations)
    .where(eq(a11yViolations.captureRunId, runId));

  const newCount = violations.filter((v) => v.isNew === 1).length;
  const existingCount = violations.filter((v) => v.isNew === 0).length;

  // Compute "fixed" count by comparing against previous run
  let fixedCount = 0;

  // Get the project for this run
  const [run] = await db
    .select({ projectId: captureRuns.projectId })
    .from(captureRuns)
    .where(eq(captureRuns.id, runId))
    .limit(1);

  if (run) {
    // Find the most recent previous completed run for this project
    const [prevRun] = await db
      .select({ id: captureRuns.id })
      .from(captureRuns)
      .where(
        and(
          eq(captureRuns.projectId, run.projectId),
          ne(captureRuns.id, runId),
        ),
      )
      .orderBy(desc(captureRuns.createdAt))
      .limit(1);

    if (prevRun) {
      // Get fingerprints from the previous run
      const prevViolations = await db
        .select({ fingerprint: a11yViolations.fingerprint })
        .from(a11yViolations)
        .where(eq(a11yViolations.captureRunId, prevRun.id));

      const currentFingerprints = new Set(violations.map((v) => v.fingerprint));
      fixedCount = prevViolations.filter(
        (pv) => !currentFingerprints.has(pv.fingerprint),
      ).length;
    }
  }

  return {
    summary: { new: newCount, fixed: fixedCount, existing: existingCount },
    violations,
  };
}

/**
 * Get latest a11y summary for a project.
 * Pure function with Db as first parameter -- usable from tRPC routers, GraphQL resolvers, or REST handlers.
 */
export async function getA11ySummaryByProject(
  db: Db,
  projectId: string,
): Promise<{
  totalViolations: number;
  newCount: number;
  latestRunId: string | null;
}> {
  // Find the most recent capture run for this project that has a11y violations
  const latestRuns = await db
    .select({ id: captureRuns.id })
    .from(captureRuns)
    .innerJoin(a11yViolations, eq(a11yViolations.captureRunId, captureRuns.id))
    .where(eq(captureRuns.projectId, projectId))
    .orderBy(desc(captureRuns.createdAt))
    .limit(1);

  if (latestRuns.length === 0) {
    return { totalViolations: 0, newCount: 0, latestRunId: null };
  }

  const latestRunId = latestRuns[0].id;

  // Count violations from that run
  const violations = await db
    .select({
      id: a11yViolations.id,
      isNew: a11yViolations.isNew,
    })
    .from(a11yViolations)
    .where(eq(a11yViolations.captureRunId, latestRunId));

  const totalViolations = violations.length;
  const newCount = violations.filter((v) => v.isNew === 1).length;

  return { totalViolations, newCount, latestRunId };
}
