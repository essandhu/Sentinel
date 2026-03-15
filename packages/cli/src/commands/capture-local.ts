import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
// Use re-exported drizzle operators from @sentinel/db to avoid dual-instance issues
import { loadConfig, processCaptureLocal, type SentinelConfigParsed } from '@sentinel/capture';
import { createSqliteDb, sqliteSchema, type SqliteDb } from '@sentinel/db';
import { FilesystemStorageAdapter } from '@sentinel/storage';
import { computeAndStoreHealthScores } from '../health-score-compute.js';
import type { DiffEntry, DiffSummary, BudgetResultEntry, FlakyRouteEntry, CaptureOptions } from './capture.js';

const { projects, captureRuns, snapshots, diffReports, testPlanRuns, lighthouseScores } = sqliteSchema;

// Drizzle operators — imported via @sentinel/db's drizzle-orm instance to avoid
// pnpm dual-instance type conflicts between Pg and SQLite drizzle copies.
const esmRequire = createRequire(import.meta.url);
const { eq, and, gte, asc } = esmRequire('drizzle-orm') as {
  eq: (col: any, val: any) => any;
  and: (...args: any[]) => any;
  gte: (col: any, val: any) => any;
  asc: (col: any) => any;
};

// ── Suite filtering (typed for SentinelConfigParsed) ─────────────────────────

function filterRoutesBySuite(
  config: SentinelConfigParsed,
  suiteName: string,
): SentinelConfigParsed {
  const suite = config.suites?.[suiteName];
  if (!suite) {
    throw new Error(`Suite "${suiteName}" is not defined in config`);
  }
  const suiteRouteSet = new Set(suite.routes);
  const filteredRoutes = config.capture.routes.filter((r) =>
    suiteRouteSet.has(r.path),
  );
  if (filteredRoutes.length === 0) {
    throw new Error(
      `Suite "${suiteName}" has no matching routes in capture.routes`,
    );
  }
  return {
    ...config,
    capture: { ...config.capture, routes: filteredRoutes },
  } as SentinelConfigParsed;
}

// ── Stability helpers (inlined from apps/api — CLI cannot import apps) ────────

function countFlips(results: Array<{ passed: boolean | string }>): number {
  if (results.length <= 1) return 0;
  let flips = 0;
  for (let i = 1; i < results.length; i++) {
    const prev = String(results[i - 1].passed) === 'true';
    const curr = String(results[i].passed) === 'true';
    if (prev !== curr) flips++;
  }
  return flips;
}

function computeStabilityScore(flipCount: number): number {
  return Math.max(0, 100 - flipCount * 10);
}

// ── Core logic (testable) ─────────────────────────────────────────────────────

/**
 * runCapture contains all business logic for the local capture command.
 * It is exported separately so unit tests can call it directly without
 * spawning a real CLI process.
 */
export async function runCapture(options: CaptureOptions): Promise<DiffSummary> {
  // 1. Load config (and optionally filter by suite)
  let config = await loadConfig(options.config);

  // 2. Create DB connection
  const sentinelDir = process.env.SENTINEL_DIR ?? '.sentinel';
  const db = createSqliteDb(`${sentinelDir}/sentinel.db`);

  // If --plan is set, delegate to executeTestPlan
  if (options.plan) {
    const planResult = await executeTestPlan(options.plan, config, db, options);
    return {
      allPassed: planResult.allPassed,
      failedCount: planResult.allPassed ? 0 : 1,
      runId: '',
      diffs: [],
    };
  }

  if (options.suite) {
    config = filterRoutesBySuite(config, options.suite);
  }

  // 3. Create storage adapter
  const storage = new FilesystemStorageAdapter(sentinelDir);
  await storage.ensureReady();

  // 4. Upsert project by name
  const existingProjects = db
    .select()
    .from(projects)
    .where(eq(projects.name, config.project))
    .all();

  let projectId: string;
  if (existingProjects.length > 0) {
    projectId = existingProjects[0].id;
  } else {
    const inserted = db
      .insert(projects)
      .values({ name: config.project })
      .returning().all();
    projectId = inserted[0].id;
  }

  // 5. Insert captureRun row
  const captureRunId = randomUUID();
  db
    .insert(captureRuns)
    .values({
      id: captureRunId,
      projectId,
      commitSha: options.commitSha ?? null,
      branchName: options.branch ?? null,
      status: 'pending',
      suiteName: options.suite ?? null,
    })
    .run();

  // 6. Run the capture pipeline
  await processCaptureLocal(
    { captureRunId, configPath: options.config, projectId, source: 'manual' },
    { db: db as any, storage },
  );

  // 6b. Compute health scores after capture completes
  computeAndStoreHealthScores(db as any, projectId);

  // 7. Query diff results: join diffReports with snapshots where snapshots.runId = captureRunId
  const rows = db
    .select()
    .from(diffReports)
    .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
    .where(eq(snapshots.runId, captureRunId))
    .all();

  // 8. Build DiffSummary
  const diffs: DiffEntry[] = rows.map((row) => {
    // drizzle join returns { diff_reports: {...}, snapshots: {...} } or flat depending on select
    // In tests the mock returns flat objects; in production drizzle returns nested.
    // Handle both shapes.
    const dr = (row as any).diff_reports ?? row;
    const snap = (row as any).snapshots ?? row;

    const pixelBp: number | null = dr.pixelDiffPercent ?? (row as any).pixelDiffPercent ?? null;
    const ssimBp: number | null = dr.ssimScore ?? (row as any).ssimScore ?? null;
    const passedStr: string = dr.passed ?? (row as any).passed ?? 'pending';
    const diffStorageKey: string = dr.diffS3Key ?? (row as any).diffS3Key ?? dr.diffStorageKey ?? (row as any).diffStorageKey ?? '';
    const url: string = snap.url ?? (row as any).url ?? '';
    const viewport: string = snap.viewport ?? (row as any).viewport ?? '';

    return {
      url,
      viewport,
      pixelDiffPercent: pixelBp != null ? pixelBp / 100 : 0,
      ssimScore: ssimBp != null ? ssimBp / 10000 : null,
      passed: passedStr === 'true',
      diffS3Key: diffStorageKey,
    };
  });

  const failedCount = diffs.filter((d) => !d.passed).length;
  const allPassed = failedCount === 0;

  // ── Budget evaluation ──────────────────────────────────────────────────────
  let budgetResults: BudgetResultEntry[] | undefined;
  let budgetsAllPassed: boolean | undefined;

  const globalThresholds = (config as any).performance?.thresholds;
  if (globalThresholds) {
    const lhRows = db
      .select()
      .from(lighthouseScores)
      .where(eq(lighthouseScores.captureRunId, captureRunId))
      .all();

    if (lhRows.length > 0) {
      const routeBudgets = (config as any).performance?.budgets as
        | Array<{ route: string; [key: string]: unknown }>
        | undefined;
      const CATEGORY_KEYS = ['performance', 'accessibility', 'bestPractices', 'seo'] as const;
      budgetResults = [];

      for (const lhRow of lhRows) {
        const scores = {
          performance: lhRow.performance,
          accessibility: lhRow.accessibility,
          bestPractices: lhRow.bestPractices,
          seo: lhRow.seo,
        };
        const matchingRoute = routeBudgets?.find((b) => b.route === lhRow.url);
        for (const cat of CATEGORY_KEYS) {
          const effectiveBudget = (matchingRoute?.[cat] as number | undefined) ?? (globalThresholds[cat] as number | undefined);
          if (effectiveBudget == null) continue;
          budgetResults.push({
            url: lhRow.url,
            category: cat,
            score: scores[cat],
            budget: effectiveBudget,
            passed: scores[cat] >= effectiveBudget,
          });
        }
      }
      budgetsAllPassed = budgetResults.length === 0 || budgetResults.every((r) => r.passed);
    }
  }

  // ── Flaky route detection ──────────────────────────────────────────────────
  let flakyRoutes: FlakyRouteEntry[] | undefined;
  let genuineFailureCount: number | undefined;
  let flakyFailureCount: number | undefined;

  if (failedCount > 0) {
    const stabilityThreshold = (config as any).flaky?.stabilityThreshold ?? 70;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    // Query 30-day diff history for this project
    const stabilityRows = db
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
      .orderBy(asc(diffReports.createdAt))
      .all();

    // Build stability map by route key
    const groups = new Map<string, Array<{ passed: boolean | string; browser: string }>>();
    for (const row of stabilityRows) {
      const key = `${row.url}|${row.viewport}`;
      const group = groups.get(key) ?? [];
      group.push({ passed: row.passed, browser: row.browser });
      groups.set(key, group);
    }

    // Classify failed diffs
    const failedDiffs = diffs.filter((d) => !d.passed);
    flakyRoutes = [];

    for (const diff of failedDiffs) {
      const key = `${diff.url}|${diff.viewport}`;
      const group = groups.get(key);
      if (group && group.length > 1) {
        const flipCount = countFlips(group);
        const stabilityScore = computeStabilityScore(flipCount);
        if (stabilityScore < stabilityThreshold) {
          flakyRoutes.push({
            url: diff.url,
            viewport: diff.viewport,
            browser: group[0].browser,
            stabilityScore,
            flipCount,
          });
        }
      }
    }

    flakyFailureCount = flakyRoutes.length;
    genuineFailureCount = failedDiffs.length - flakyFailureCount;
  }

  return {
    allPassed, failedCount, runId: captureRunId, diffs,
    budgetResults, budgetsAllPassed,
    flakyRoutes, genuineFailureCount, flakyFailureCount,
  };
}

// ── Test plan execution ──────────────────────────────────────────────────────

export interface TestPlanResult {
  allPassed: boolean;
  completedSteps: string[];
  failedAtStep?: string;
}

/**
 * Execute a test plan: run suites sequentially with gating.
 * Stops at first failing suite and records failedAtStep.
 */
export async function executeTestPlan(
  planName: string,
  config: SentinelConfigParsed,
  db: any,
  options: CaptureOptions,
  captureFn: (opts: CaptureOptions) => Promise<DiffSummary> = runCapture,
): Promise<TestPlanResult> {
  const plan = config.testPlans?.[planName];
  if (!plan) {
    throw new Error(`Test plan "${planName}" is not defined in config`);
  }

  // Look up project
  const existingProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.name, config.project));

  let projectId: string;
  if (existingProjects.length > 0) {
    projectId = existingProjects[0].id;
  } else {
    const inserted = await db
      .insert(projects)
      .values({ name: config.project })
      .returning();
    projectId = inserted[0].id;
  }

  // Insert test_plan_runs record
  const planRunId = randomUUID();
  await db
    .insert(testPlanRuns)
    .values({
      id: planRunId,
      projectId,
      planName,
      status: 'running',
    })
    .returning();

  const completedSteps: string[] = [];

  for (const step of plan.steps) {
    // Run capture for this suite (avoid recursion by not passing plan)
    const suiteResult = await captureFn({
      ...options,
      suite: step.suite,
      plan: undefined,
    });

    if (!suiteResult.allPassed) {
      // Update test_plan_runs to failed
      await db
        .update(testPlanRuns)
        .set({
          status: 'failed',
          failedAtStep: step.suite,
          completedAt: new Date(),
        })
        .where(eq(testPlanRuns.id, planRunId));

      return { allPassed: false, completedSteps, failedAtStep: step.suite };
    }

    completedSteps.push(step.suite);
  }

  // All steps passed
  await db
    .update(testPlanRuns)
    .set({
      status: 'completed',
      completedAt: new Date(),
    })
    .where(eq(testPlanRuns.id, planRunId));

  return { allPassed: true, completedSteps };
}
