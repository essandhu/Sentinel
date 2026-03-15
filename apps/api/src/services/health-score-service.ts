import { eq, and, gte, lt, desc, count, sql } from 'drizzle-orm';
import type { S3Client } from '@aws-sdk/client-s3';
import {
  projects,
  captureRuns,
  snapshots,
  diffReports,
  components,
  healthScores,
  a11yViolations,
  type Db,
} from '@sentinel/db';
import { downloadBuffer } from '@sentinel/storage';
import { runDualDiff } from '@sentinel/capture';
import { computeAveragePerfScore } from './lighthouse-query-service.js';

/** Tighter thresholds for cross-page component consistency (matching components router). */
const CONSISTENCY_THRESHOLDS = { pixelDiffPercent: 0.5, ssimMin: 0.98 };

export interface HealthScoreDeps {
  storageClient: S3Client;
  bucket: string;
}

/**
 * Compute a project-level health score as percentage of passed diffs in a rolling window.
 * Returns -1 when no diffs exist in the window (no data sentinel).
 *
 * When a11yScore >= 0, blends 70% diff pass rate + 30% a11y score.
 * When a11yScore is -1 or undefined, returns pure diff pass rate (backward compatible).
 */
export async function computeProjectHealthScore(
  db: Db,
  projectId: string,
  windowDays: number = 30,
  a11yScore?: number,
  perfScore?: number,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const [result] = await db
    .select({
      total: count(),
      passed: count(sql`CASE WHEN ${diffReports.passed} = 'true' THEN 1 END`),
    })
    .from(diffReports)
    .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .where(
      and(
        eq(captureRuns.projectId, projectId),
        gte(diffReports.createdAt, cutoff),
      ),
    );

  const total = parseInt(String(result?.total ?? 0), 10);
  const passed = parseInt(String(result?.passed ?? 0), 10);

  if (total === 0) return -1;

  const diffPassRate = Math.round((passed / total) * 100);

  const hasA11y = a11yScore !== undefined && a11yScore >= 0;
  const hasPerf = perfScore !== undefined && perfScore >= 0;

  // 3-way blend: 50% visual + 25% a11y + 25% perf
  if (hasA11y && hasPerf) {
    return Math.round(diffPassRate * 0.5 + a11yScore * 0.25 + perfScore * 0.25);
  }
  // 2-way blend with a11y only: 70% visual + 30% a11y
  if (hasA11y) {
    return Math.round(diffPassRate * 0.7 + a11yScore * 0.3);
  }
  // 2-way blend with perf only: 70% visual + 30% perf
  if (hasPerf) {
    return Math.round(diffPassRate * 0.7 + perfScore * 0.3);
  }

  return diffPassRate;
}

/**
 * Compute per-component health scores that blend diff pass rate and consistency rate.
 * When a11yScore >= 0: 50% diff + 25% consistency + 25% a11y.
 * When a11yScore is -1 or undefined: 70% diff + 30% consistency (backward compatible).
 * Returns -1 for components with no diffs.
 */
export async function computeComponentHealthScores(
  db: Db,
  projectId: string,
  windowDays: number = 30,
  deps: HealthScoreDeps,
  a11yScore?: number,
  perfScore?: number,
): Promise<Array<{ componentId: string; componentName: string; score: number }>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  // Get all enabled components for the project
  const enabledComponents = await db
    .select({
      id: components.id,
      projectId: components.projectId,
      name: components.name,
      enabled: components.enabled,
    })
    .from(components)
    .where(
      and(
        eq(components.projectId, projectId),
        eq(components.enabled, 1),
      ),
    );

  const results: Array<{ componentId: string; componentName: string; score: number }> = [];

  for (const component of enabledComponents) {
    // Compute component diff pass rate
    const [diffStats] = await db
      .select({
        total: count(),
        passed: count(sql`CASE WHEN ${diffReports.passed} = 'true' THEN 1 END`),
      })
      .from(diffReports)
      .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
      .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
      .where(
        and(
          eq(captureRuns.projectId, projectId),
          eq(snapshots.componentId, component.id),
          gte(diffReports.createdAt, cutoff),
        ),
      );

    const total = parseInt(String(diffStats?.total ?? 0), 10);
    const passed = parseInt(String(diffStats?.passed ?? 0), 10);

    if (total === 0) {
      results.push({ componentId: component.id, componentName: component.name, score: -1 });
      continue;
    }

    const diffPassRate = (passed / total) * 100;

    // Compute consistency rate (replicate components.consistency logic)
    let consistencyRate = 100; // Default: fully consistent
    try {
      consistencyRate = await computeConsistencyRate(db, component.id, projectId, deps);
    } catch (err) {
      // Graceful fallback per Phase 11 decision
      console.warn(`[health-score] Consistency check failed for component ${component.id}:`, err);
      consistencyRate = 100;
    }

    // Blend based on available data dimensions
    const hasA11y = a11yScore !== undefined && a11yScore >= 0;
    const hasPerf = perfScore !== undefined && perfScore >= 0;

    let score: number;
    if (hasA11y && hasPerf) {
      // 4-way: 40% diff + 20% consistency + 20% a11y + 20% perf
      score = Math.round(diffPassRate * 0.4 + consistencyRate * 0.2 + a11yScore * 0.2 + perfScore * 0.2);
    } else if (hasA11y) {
      // 3-way with a11y: 50% diff + 25% consistency + 25% a11y
      score = Math.round(diffPassRate * 0.5 + consistencyRate * 0.25 + a11yScore * 0.25);
    } else if (hasPerf) {
      // 3-way with perf: 50% diff + 25% consistency + 25% perf
      score = Math.round(diffPassRate * 0.5 + consistencyRate * 0.25 + perfScore * 0.25);
    } else {
      // 2-way: 70% diff + 30% consistency
      score = Math.round(diffPassRate * 0.7 + consistencyRate * 0.3);
    }
    results.push({ componentId: component.id, componentName: component.name, score });
  }

  return results;
}

/**
 * Compute consistency rate for a component across URLs.
 * Returns percentage (0-100) of URLs that are 'consistent'.
 */
async function computeConsistencyRate(
  db: Db,
  componentId: string,
  projectId: string,
  deps: HealthScoreDeps,
): Promise<number> {
  // Get latest snapshots for this component, grouped by URL
  const componentSnapshots = await db
    .select({
      id: snapshots.id,
      url: snapshots.url,
      s3Key: snapshots.s3Key,
      capturedAt: snapshots.capturedAt,
    })
    .from(snapshots)
    .where(eq(snapshots.componentId, componentId))
    .orderBy(desc(snapshots.capturedAt));

  // Group by URL, keeping only latest per URL
  const byUrl = new Map<string, { s3Key: string }>();
  for (const snap of componentSnapshots) {
    if (!byUrl.has(snap.url)) {
      byUrl.set(snap.url, { s3Key: snap.s3Key });
    }
  }

  // Get all project URLs from page-level captures
  const projectUrls = await db
    .select({ url: snapshots.url })
    .from(snapshots)
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .where(eq(captureRuns.projectId, projectId));

  const uniqueUrls = [...new Set(projectUrls.map((r: { url: string }) => r.url))];
  const urlsWithSnapshots = uniqueUrls.filter(url => byUrl.has(url));

  if (urlsWithSnapshots.length < 2) {
    return 100; // Nothing to compare
  }

  // Sort alphabetically and use first as reference
  const sorted = [...urlsWithSnapshots].sort();
  const referenceUrl = sorted[0];
  const referenceSnap = byUrl.get(referenceUrl)!;

  let consistentCount = 1; // Reference is always consistent
  let totalCompared = sorted.length;

  try {
    const referenceBuffer = await downloadBuffer(deps.storageClient, deps.bucket, referenceSnap.s3Key);

    for (const otherUrl of sorted.slice(1)) {
      const otherSnap = byUrl.get(otherUrl)!;
      try {
        const otherBuffer = await downloadBuffer(deps.storageClient, deps.bucket, otherSnap.s3Key);
        const diffResult = await runDualDiff(referenceBuffer, otherBuffer, CONSISTENCY_THRESHOLDS);
        if (diffResult.passed) {
          consistentCount++;
        }
      } catch {
        // Graceful fallback on individual diff failure
        consistentCount++;
      }
    }
  } catch {
    // Reference download failure: all consistent (graceful fallback)
    return 100;
  }

  return Math.round((consistentCount / totalCompared) * 100);
}

/**
 * Compute accessibility score for a project.
 * Returns percentage of route+viewport+browser combos with zero isNew=1 violations (0-100).
 * Returns -1 when no a11y data exists for the project.
 */
export async function computeA11yScore(
  db: Db,
  projectId: string,
): Promise<number> {
  // Get the most recent capture run for this project
  const [latestRun] = await db
    .select({ id: captureRuns.id })
    .from(captureRuns)
    .where(eq(captureRuns.projectId, projectId))
    .orderBy(desc(captureRuns.createdAt))
    .limit(1);

  if (!latestRun) return -1;

  // Get all distinct (url, viewport, browser) combos from a11y_violations for that run
  const allCombos = await db
    .select({
      url: a11yViolations.url,
      viewport: a11yViolations.viewport,
      browser: a11yViolations.browser,
    })
    .from(a11yViolations)
    .where(eq(a11yViolations.captureRunId, latestRun.id));

  // Deduplicate combos
  const comboSet = new Set<string>();
  for (const row of allCombos) {
    comboSet.add(`${row.url}|${row.viewport}|${row.browser}`);
  }

  const totalCombos = comboSet.size;
  if (totalCombos === 0) return -1; // No a11y data

  // Get combos that have at least one isNew=1 violation
  const regressedCombos = await db
    .select({
      url: a11yViolations.url,
      viewport: a11yViolations.viewport,
      browser: a11yViolations.browser,
    })
    .from(a11yViolations)
    .where(
      and(
        eq(a11yViolations.captureRunId, latestRun.id),
        eq(a11yViolations.isNew, 1),
      ),
    );

  const regressedSet = new Set<string>();
  for (const row of regressedCombos) {
    regressedSet.add(`${row.url}|${row.viewport}|${row.browser}`);
  }

  const cleanCombos = totalCombos - regressedSet.size;
  return Math.round((cleanCombos / totalCombos) * 100);
}

/**
 * Compute health scores for all active projects (those with captures in last 30 days).
 * Writes project-level scores (componentId=null) and per-component scores.
 * Cleans up scores older than 90 days.
 */
export async function computeAllHealthScores(
  db: Db,
  deps: HealthScoreDeps,
): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  // Find active projects: distinct projects with recent captures
  const activeProjects = await db
    .select({ projectId: captureRuns.projectId })
    .from(captureRuns)
    .where(gte(captureRuns.createdAt, cutoff));

  const uniqueProjectIds = [...new Set(activeProjects.map(r => r.projectId))];

  for (const projectId of uniqueProjectIds) {
    // Compute a11y and perf scores for this project (used in both project and component scoring)
    const a11yScore = await computeA11yScore(db, projectId);
    const perfScore = await computeAveragePerfScore(db, projectId);

    // Compute project-level score (with optional a11y + perf blending)
    const projectScore = await computeProjectHealthScore(db, projectId, 30, a11yScore, perfScore);

    // Insert project-level score (componentId=null)
    await db.insert(healthScores).values({
      projectId,
      componentId: null,
      score: projectScore,
      windowDays: 30,
    });

    // Compute component-level scores (with optional a11y + perf blending)
    const componentScores = await computeComponentHealthScores(db, projectId, 30, deps, a11yScore, perfScore);

    for (const cs of componentScores) {
      await db.insert(healthScores).values({
        projectId,
        componentId: cs.componentId,
        score: cs.score,
        windowDays: 30,
      });
    }
  }

  // Cleanup: delete scores older than 90 days
  const retentionCutoff = new Date();
  retentionCutoff.setDate(retentionCutoff.getDate() - 90);

  await db.delete(healthScores).where(lt(healthScores.computedAt, retentionCutoff));
}
