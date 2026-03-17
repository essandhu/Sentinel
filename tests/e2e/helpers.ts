import { eq } from 'drizzle-orm';
import { sqliteSchema, type SqliteDb } from '@sentinel-vrt/db';

const {
  projects,
  captureRuns,
  snapshots,
  baselines,
  diffReports,
  diffClassifications,
  diffRegions,
  layoutShifts,
  approvalDecisions,
  a11yViolations,
  healthScores,
  lighthouseScores,
  performanceBudgets,
  components,
  breakpointPresets,
  testPlanRuns,
  classificationOverrides,
  designSources,
  testSuites,
} = sqliteSchema;

/**
 * Delete all test data associated with a project name, in reverse
 * foreign-key order so that constraints are not violated.
 *
 * Uses Drizzle ORM against the SQLite database.
 */
export async function cleanupTestData(
  db: SqliteDb,
  projectName: string,
): Promise<void> {
  // Resolve the project id(s) matching the given name.
  const projectRows = db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.name, projectName))
    .all();

  if (projectRows.length === 0) return;

  const projectIds = projectRows.map((r) => r.id);

  for (const pid of projectIds) {
    // --- Leaf tables first, working up toward projects ---

    // Get capture run ids for this project
    const runRows = db
      .select({ id: captureRuns.id })
      .from(captureRuns)
      .where(eq(captureRuns.projectId, pid))
      .all();
    const runIds = runRows.map((r) => r.id);

    // Get snapshot ids for these runs
    const snapIds: string[] = [];
    for (const rid of runIds) {
      const snaps = db
        .select({ id: snapshots.id })
        .from(snapshots)
        .where(eq(snapshots.runId, rid))
        .all();
      snapIds.push(...snaps.map((s) => s.id));
    }

    // Get diff report ids for these snapshots
    const diffIds: string[] = [];
    for (const sid of snapIds) {
      const diffs = db
        .select({ id: diffReports.id })
        .from(diffReports)
        .where(eq(diffReports.snapshotId, sid))
        .all();
      diffIds.push(...diffs.map((d) => d.id));
    }

    // Delete leaf tables
    for (const did of diffIds) {
      db.delete(approvalDecisions).where(eq(approvalDecisions.diffReportId, did)).run();
      db.delete(layoutShifts).where(eq(layoutShifts.diffReportId, did)).run();
      db.delete(diffRegions).where(eq(diffRegions.diffReportId, did)).run();
      db.delete(diffClassifications).where(eq(diffClassifications.diffReportId, did)).run();
      db.delete(classificationOverrides).where(eq(classificationOverrides.diffReportId, did)).run();
    }

    // diff_reports
    for (const sid of snapIds) {
      db.delete(diffReports).where(eq(diffReports.snapshotId, sid)).run();
    }

    // baselines
    db.delete(baselines).where(eq(baselines.projectId, pid)).run();

    // lighthouse_scores, a11y_violations
    for (const rid of runIds) {
      db.delete(lighthouseScores).where(eq(lighthouseScores.captureRunId, rid)).run();
    }
    db.delete(a11yViolations).where(eq(a11yViolations.projectId, pid)).run();

    // snapshots
    for (const rid of runIds) {
      db.delete(snapshots).where(eq(snapshots.runId, rid)).run();
    }

    // capture_runs
    db.delete(captureRuns).where(eq(captureRuns.projectId, pid)).run();

    // health_scores
    db.delete(healthScores).where(eq(healthScores.projectId, pid)).run();

    // components
    db.delete(components).where(eq(components.projectId, pid)).run();

    // breakpoint_presets
    db.delete(breakpointPresets).where(eq(breakpointPresets.projectId, pid)).run();

    // performance_budgets
    db.delete(performanceBudgets).where(eq(performanceBudgets.projectId, pid)).run();

    // test_suites
    db.delete(testSuites).where(eq(testSuites.projectId, pid)).run();

    // design_sources
    db.delete(designSources).where(eq(designSources.projectId, pid)).run();

    // test_plan_runs
    db.delete(testPlanRuns).where(eq(testPlanRuns.projectId, pid)).run();

    // projects
    db.delete(projects).where(eq(projects.id, pid)).run();
  }
}
