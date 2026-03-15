import chalk from 'chalk';
import { randomUUID } from 'node:crypto';

// Re-export types so existing consumers (index.ts, GitHub Action) still work
export type {
  DiffEntry,
  DiffSummary,
  BudgetResultEntry,
  FlakyRouteEntry,
  CaptureOptions,
} from './capture-remote.js';

import type { CaptureOptions } from './capture-remote.js';

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

  // Ensure browsers are available before starting the capture run
  const browsers = config.browsers ?? ['chromium'];
  await ensureBrowserInstalled(browsers);

  const runtime = await initLocalRuntime(process.cwd());

  try {
    // Ensure project exists (use relational query API to avoid drizzle-orm dual-instance issues)
    const projectName = config.project ?? 'default';
    let project = await runtime.db.query.projects.findFirst({
      where: (projects, { eq }) => eq(projects.name, projectName),
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
        where: (projects, { eq }) => eq(projects.id, id),
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
        configPath: options.config,
        projectId: project.id,
        source: options.ci ? 'ci' : 'manual',
      },
      {
        db: runtime.db as any, // SqliteDb used in place of Db -- compatible via drizzle abstraction
        storage: runtime.storage,
        onProgress: progressCallbacks,
      },
    );

    // Output results
    if (options.ci) {
      // JSON output for CI pipelines
      console.log(
        JSON.stringify({
          runId: summary.captureRunId,
          totalSnapshots: summary.totalSnapshots,
          passed: summary.passed,
          failed: summary.failed,
          newBaselines: summary.newBaselines,
          allPassed: summary.failed === 0,
        }),
      );
    } else {
      console.log('');
      console.log(chalk.bold('Results:'));
      console.log(`  Total: ${summary.totalSnapshots}`);
      console.log(`  ${chalk.green('Passed')}: ${summary.passed}`);
      console.log(`  ${chalk.red('Failed')}: ${summary.failed}`);
      console.log(`  ${chalk.yellow('New baselines')}: ${summary.newBaselines}`);
    }

    if (summary.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    runtime.close();
  }
}
