import chalk from 'chalk';
import { randomUUID } from 'node:crypto';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify as yamlStringify } from 'yaml';

// Re-export types so existing consumers (index.ts, GitHub Action) still work
export type {
  DiffEntry,
  DiffSummary,
  BudgetResultEntry,
  FlakyRouteEntry,
  CaptureOptions,
} from './capture-remote.js';

import type {
  CaptureOptions,
  DiffEntry,
  BudgetResultEntry,
  FlakyRouteEntry,
  DiffSummary,
} from './capture-remote.js';

// ── Stability helpers (ported from capture-local.ts) ─────────────────────────

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

// ── Test plan result type ────────────────────────────────────────────────────

export interface TestPlanResult {
  allPassed: boolean;
  completedSteps: string[];
  failedAtStep?: string;
}

// ── CLI entry point ───────────────────────────────────────────────────────────

/**
 * captureCommand is the Commander action handler.
 * Local mode is the default; --remote delegates to the API-based capture.
 */
export async function captureCommand(options: CaptureOptions): Promise<void> {
  try {
    if (options.remote) {
      const { runRemoteCapture } = await import('./capture-remote.js');
      const summary = await runRemoteCapture(options);

      // Remote mode outputs JSON (same as before)
      process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
      process.exitCode = summary.allPassed ? 0 : 1;
      return;
    }

    await runLocalCapture(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`sentinel capture failed: ${message}\n`);
    process.exitCode = 1;
  }
}

// ── Local capture (default) ──────────────────────────────────────────────────

async function runLocalCapture(options: CaptureOptions): Promise<void> {
  const { loadConfig } = await import('@sentinel/capture');
  const { initLocalRuntime } = await import('../local-runtime.js');
  const { ensureBrowserInstalled } = await import('../browser-install.js');

  const config = await loadConfig(options.config);

  // If --plan is set, delegate to test plan execution
  if (options.plan) {
    const runtime = await initLocalRuntime(process.cwd());
    try {
      const planResult = await executeTestPlan(options.plan, config, runtime, options);
      if (!options.ci) {
        console.log('');
        console.log(chalk.bold('Test Plan Results:'));
        console.log(`  Completed steps: ${planResult.completedSteps.join(', ') || '(none)'}`);
        if (planResult.allPassed) {
          console.log(chalk.green('  All steps passed.'));
        } else {
          console.log(chalk.red(`  Failed at step: ${planResult.failedAtStep}`));
        }
      } else {
        console.log(JSON.stringify(planResult));
      }
      if (!planResult.allPassed) {
        process.exitCode = 1;
      }
    } finally {
      runtime.close();
    }
    return;
  }

  // Suite filtering: validate suite exists and write a temp config with filtered routes
  // so that processCaptureLocal only captures suite routes.
  let effectiveConfigPath = options.config;
  let tempConfigDir: string | null = null;

  if (options.suite) {
    const { filterRoutesBySuite } = await import('./capture-remote.js');
    const filteredConfig = filterRoutesBySuite(config, options.suite);
    // Write filtered config to a temp file for processCaptureLocal
    tempConfigDir = mkdtempSync(join(tmpdir(), 'sentinel-suite-'));
    effectiveConfigPath = join(tempConfigDir, 'sentinel.config.yaml');
    writeFileSync(effectiveConfigPath, yamlStringify(filteredConfig), 'utf-8');
  }

  // Ensure browsers are available before starting the capture run
  const browsers = config.browsers ?? ['chromium'];
  await ensureBrowserInstalled(browsers);

  const runtime = await initLocalRuntime(process.cwd());

  try {
    // Ensure project exists (use relational query API to avoid drizzle-orm dual-instance issues)
    const projectName = config.project ?? 'default';
    let project = await runtime.db.query.projects.findFirst({
      where: (projects: any, { eq }: any) => eq(projects.name, projectName),
    });

    if (!project) {
      const { sqliteSchema } = await import('@sentinel/db');
      const id = randomUUID();
      runtime.db.insert(sqliteSchema.projects).values({
        id,
        name: projectName,
        createdAt: new Date(),
      }).run();
      project = (await runtime.db.query.projects.findFirst({
        where: (projects: any, { eq }: any) => eq(projects.id, id),
      }))!;
    }

    // Detect branch/commit from env or flags
    const branchName =
      options.branch ??
      process.env.GITHUB_REF_NAME ??
      process.env.CI_COMMIT_BRANCH ??
      'main';
    const commitSha =
      options.commitSha ??
      process.env.GITHUB_SHA ??
      process.env.CI_COMMIT_SHA;

    // Create capture run
    const runId = randomUUID();
    {
      const { sqliteSchema } = await import('@sentinel/db');
      runtime.db.insert(sqliteSchema.captureRuns).values({
        id: runId,
        projectId: project.id,
        status: 'pending',
        branchName,
        commitSha: commitSha ?? null,
        source: options.ci ? 'ci' : 'manual',
        suiteName: options.suite ?? null,
        createdAt: new Date(),
      }).run();
    }

    if (!options.ci) {
      console.log(chalk.blue(`Starting capture run ${runId.slice(0, 8)}...`));
    }

    // Run capture in-process using the local adapter
    // Import from the worker module which exports processCaptureLocal
    const { processCaptureLocal } = await import('@sentinel/capture');

    const progressCallbacks = options.ci
      ? undefined
      : {
          onPhase(phase: string) {
            console.log(
              chalk.blue(
                `\n${phase.charAt(0).toUpperCase() + phase.slice(1)}...`,
              ),
            );
          },
          onRouteStart(route: string, viewport: string, browser: string) {
            console.log(
              chalk.dim(`  Capturing ${route} @ ${viewport} [${browser}]`),
            );
          },
          onRouteComplete(
            route: string,
            result: { passed: boolean; diffPercent: number },
          ) {
            const icon = result.passed ? chalk.green('\u2713') : chalk.red('\u2717');
            console.log(
              `  ${icon} ${route} \u2014 ${result.diffPercent.toFixed(2)}% diff`,
            );
          },
        };

    const summary = await processCaptureLocal(
      {
        captureRunId: runId,
        configPath: effectiveConfigPath,
        projectId: project.id,
        source: options.ci ? 'ci' : 'manual',
      },
      {
        db: runtime.db as any, // SqliteDb used in place of Db -- compatible via drizzle abstraction
        storage: runtime.storage,
        onProgress: progressCallbacks,
      },
    );

    // Clean up temp config file if suite filtering was used
    if (tempConfigDir) {
      try {
        unlinkSync(effectiveConfigPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Compute health scores after capture completes
    const { computeAndStoreHealthScores } = await import('../health-score-compute.js');
    computeAndStoreHealthScores(runtime.db as any, project.id);

    // ── Diff detail query ──────────────────────────────────────────────────
    const db = (runtime.db as any).$client;

    const diffRows = db.prepare(`
      SELECT
        d.pixel_diff_percent,
        d.ssim_score,
        d.passed,
        d.diff_s3_key,
        s.url,
        s.viewport
      FROM diff_reports d
      INNER JOIN snapshots s ON d.snapshot_id = s.id
      WHERE s.run_id = ?
    `).all(runId) as Array<{
      pixel_diff_percent: number | null;
      ssim_score: number | null;
      passed: string;
      diff_s3_key: string | null;
      url: string;
      viewport: string;
    }>;

    const diffs: DiffEntry[] = diffRows.map((row) => ({
      url: row.url,
      viewport: row.viewport,
      pixelDiffPercent: row.pixel_diff_percent != null ? row.pixel_diff_percent / 100 : 0,
      ssimScore: row.ssim_score != null ? row.ssim_score / 10000 : null,
      passed: row.passed === 'true',
      diffS3Key: row.diff_s3_key ?? '',
    }));

    const failedCount = diffs.filter((d) => !d.passed).length;
    const allPassed = failedCount === 0;

    // ── Budget evaluation ──────────────────────────────────────────────────
    let budgetResults: BudgetResultEntry[] | undefined;
    let budgetsAllPassed: boolean | undefined;

    const globalThresholds = (config as any).performance?.thresholds;
    if (globalThresholds) {
      const lhRows = db.prepare(`
        SELECT url, performance, accessibility, best_practices, seo
        FROM lighthouse_scores
        WHERE capture_run_id = ?
      `).all(runId) as Array<{
        url: string;
        performance: number;
        accessibility: number;
        best_practices: number;
        seo: number;
      }>;

      if (lhRows.length > 0) {
        const routeBudgets = (config as any).performance?.budgets as
          | Array<{ route: string; [key: string]: unknown }>
          | undefined;
        const CATEGORY_KEYS = ['performance', 'accessibility', 'bestPractices', 'seo'] as const;
        budgetResults = [];

        for (const lhRow of lhRows) {
          const scores: Record<string, number> = {
            performance: lhRow.performance,
            accessibility: lhRow.accessibility,
            bestPractices: lhRow.best_practices,
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

    // ── Flaky route detection ──────────────────────────────────────────────
    let flakyRoutes: FlakyRouteEntry[] | undefined;
    let genuineFailureCount: number | undefined;
    let flakyFailureCount: number | undefined;

    if (failedCount > 0) {
      const stabilityThreshold = (config as any).flaky?.stabilityThreshold ?? 70;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffMs = cutoff.getTime();

      // Query 30-day diff history for this project
      const stabilityRows = db.prepare(`
        SELECT
          s.url,
          s.viewport,
          s.browser,
          d.passed,
          d.created_at
        FROM diff_reports d
        INNER JOIN snapshots s ON d.snapshot_id = s.id
        INNER JOIN capture_runs cr ON s.run_id = cr.id
        WHERE cr.project_id = ?
          AND d.created_at >= ?
        ORDER BY d.created_at ASC
      `).all(project.id, cutoffMs) as Array<{
        url: string;
        viewport: string;
        browser: string;
        passed: string;
        created_at: number;
      }>;

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

    // ── Record threshold history & show recommendations ──────────────────
    const adaptiveConfig = (config as any).adaptiveThresholds;
    if (adaptiveConfig?.enabled) {
      const { recordDiffHistory, getThresholdRecommendations } = await import('../threshold-reporter.js');
      recordDiffHistory(runtime.db, project.id, runId, diffs);

      const recs = getThresholdRecommendations(runtime.db, project.id, adaptiveConfig.minRuns ?? 5);
      if (recs.length > 0 && !options.ci) {
        console.log('');
        console.log(chalk.cyan.bold('Threshold Recommendations:'));
        for (const rec of recs) {
          console.log(chalk.cyan(`  ${rec.url} @ ${rec.viewport}: pixelDiff \u2264 ${rec.recommended.pixelDiffPercent.toFixed(2)}%, ssim \u2265 ${rec.recommended.ssimMin.toFixed(4)} (${rec.dataPoints} runs)`));
        }
      }
    }

    // ── Rich output ────────────────────────────────────────────────────────
    if (options.ci) {
      // JSON output for CI pipelines
      console.log(
        JSON.stringify({
          runId: summary.captureRunId,
          totalSnapshots: summary.totalSnapshots,
          passed: summary.passed,
          failed: summary.failed,
          newBaselines: summary.newBaselines,
          allPassed,
          diffs,
          budgetResults,
          budgetsAllPassed,
          flakyRoutes,
          genuineFailureCount,
          flakyFailureCount,
        }),
      );
    } else {
      // Per-diff detail output
      if (diffs.length > 0) {
        console.log('');
        console.log(chalk.bold('Diff Details:'));
        for (const diff of diffs) {
          const icon = diff.passed ? chalk.green('\u2713') : chalk.red('\u2717');
          const pct = (diff.pixelDiffPercent * 100).toFixed(2);
          const status = diff.passed ? chalk.green('PASS') : chalk.red('FAIL');
          console.log(`  ${icon} ${diff.url} @ ${diff.viewport} \u2014 ${pct}% diff [${status}]`);
        }
      }

      // Budget results
      if (budgetResults && budgetResults.length > 0) {
        console.log('');
        console.log(chalk.bold('Budget Results:'));
        for (const br of budgetResults) {
          const icon = br.passed ? chalk.green('\u2713') : chalk.red('\u2717');
          console.log(`  ${icon} ${br.url} ${br.category}: ${br.score} (budget: ${br.budget})`);
        }
        if (budgetsAllPassed) {
          console.log(chalk.green('  All budgets passed.'));
        } else {
          console.log(chalk.red('  Some budgets failed.'));
        }
      }

      // Flaky route warnings
      if (flakyRoutes && flakyRoutes.length > 0) {
        console.log('');
        console.log(chalk.yellow.bold('Flaky Routes Detected:'));
        for (const fr of flakyRoutes) {
          console.log(
            chalk.yellow(`  ! ${fr.url} @ ${fr.viewport} [${fr.browser}] \u2014 stability: ${fr.stabilityScore}% (${fr.flipCount} flips)`),
          );
        }
        console.log(chalk.yellow(`  ${genuineFailureCount} genuine failure(s), ${flakyFailureCount} flaky failure(s)`));
      }

      console.log('');
      console.log(chalk.bold('Results:'));
      console.log(`  Total: ${summary.totalSnapshots}`);
      console.log(`  ${chalk.green('Passed')}: ${summary.passed}`);
      console.log(`  ${chalk.red('Failed')}: ${summary.failed}`);
      console.log(`  ${chalk.yellow('New baselines')}: ${summary.newBaselines}`);
    }

    if (!allPassed || (budgetsAllPassed === false)) {
      process.exitCode = 1;
    }
  } finally {
    runtime.close();
  }
}

// ── Test plan execution ──────────────────────────────────────────────────────

/**
 * Execute a test plan: run suites sequentially with gating.
 * Stops at first failing suite and records failedAtStep.
 */
async function executeTestPlan(
  planName: string,
  config: any,
  runtime: any,
  options: CaptureOptions,
): Promise<TestPlanResult> {
  const plan = config.testPlans?.[planName];
  if (!plan) {
    throw new Error(`Test plan "${planName}" is not defined in config`);
  }

  const db = (runtime.db as any).$client;

  // Look up project
  const projectName = config.project ?? 'default';
  const projectRow = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName) as { id: string } | undefined;

  if (!projectRow) {
    throw new Error(`Project "${projectName}" not found`);
  }

  // Insert test_plan_runs record
  const planRunId = randomUUID();
  db.prepare(
    'INSERT INTO test_plan_runs (id, project_id, plan_name, status, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(planRunId, projectRow.id, planName, 'running', Date.now());

  const completedSteps: string[] = [];

  for (const step of plan.steps) {
    // Run capture for this suite (avoid recursion by not passing plan)
    const suiteOptions: CaptureOptions = {
      ...options,
      suite: step.suite,
      plan: undefined,
    };

    // Re-enter runLocalCapture for this suite step, but we need to check the result.
    // We call runLocalCapture internally and check exit code, but that's not clean.
    // Instead, run a mini-capture and check the DB for results.
    const { loadConfig: loadCfg, processCaptureLocal } = await import('@sentinel/capture');
    const { filterRoutesBySuite } = await import('./capture-remote.js');

    const suiteConfig = await loadCfg(options.config);
    const filteredConfig = filterRoutesBySuite(suiteConfig, step.suite);

    // Write temp config for this suite
    const tmpDir = mkdtempSync(join(tmpdir(), 'sentinel-plan-'));
    const tmpConfigPath = join(tmpDir, 'sentinel.config.yaml');
    writeFileSync(tmpConfigPath, yamlStringify(filteredConfig), 'utf-8');

    const suiteRunId = randomUUID();
    const { sqliteSchema } = await import('@sentinel/db');
    runtime.db.insert(sqliteSchema.captureRuns).values({
      id: suiteRunId,
      projectId: projectRow.id,
      status: 'pending',
      branchName: options.branch ?? 'main',
      commitSha: options.commitSha ?? null,
      source: options.ci ? 'ci' : 'manual',
      suiteName: step.suite,
      testPlanRunId: planRunId,
      createdAt: new Date(),
    }).run();

    if (!options.ci) {
      console.log(chalk.blue(`\nRunning suite "${step.suite}" (step ${completedSteps.length + 1})...`));
    }

    const suiteSummary = await processCaptureLocal(
      {
        captureRunId: suiteRunId,
        configPath: tmpConfigPath,
        projectId: projectRow.id,
        source: options.ci ? 'ci' : 'manual',
      },
      {
        db: runtime.db as any,
        storage: runtime.storage,
      },
    );

    // Clean up temp config
    try { unlinkSync(tmpConfigPath); } catch { /* ignore */ }

    if (suiteSummary.failed > 0) {
      // Update test_plan_runs to failed
      db.prepare(
        'UPDATE test_plan_runs SET status = ?, failed_at_step = ?, completed_at = ? WHERE id = ?',
      ).run('failed', step.suite, Date.now(), planRunId);

      return { allPassed: false, completedSteps, failedAtStep: step.suite };
    }

    completedSteps.push(step.suite);
  }

  // All steps passed
  db.prepare(
    'UPDATE test_plan_runs SET status = ?, completed_at = ? WHERE id = ?',
  ).run('completed', Date.now(), planRunId);

  return { allPassed: true, completedSteps };
}
