import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { loadCredentials } from './login.js';
import { SentinelClient } from '../api-client.js';

// ── Public types (shared with capture.ts) ────────────────────────────────────

export interface DiffEntry {
  url: string;
  viewport: string;
  pixelDiffPercent: number;
  ssimScore: number | null;
  passed: boolean;
  diffS3Key: string;
}

export interface BudgetResultEntry {
  url: string;
  category: string;
  score: number;
  budget: number;
  passed: boolean;
}

export interface FlakyRouteEntry {
  url: string;
  viewport: string;
  browser: string;
  stabilityScore: number;
  flipCount: number;
}

export interface DiffSummary {
  allPassed: boolean;
  failedCount: number;
  runId: string;
  diffs: DiffEntry[];
  budgetResults?: BudgetResultEntry[];
  budgetsAllPassed?: boolean;
  flakyRoutes?: FlakyRouteEntry[];
  genuineFailureCount?: number;
  flakyFailureCount?: number;
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface CaptureOptions {
  config: string;
  commitSha?: string;
  branch?: string;
  suite?: string;
  plan?: string;
  ci?: boolean;
  remote?: boolean;
}

/**
 * Filter config routes to only those in the named suite.
 * Throws if suite not found or produces empty route list.
 * Works on plain parsed YAML objects -- no heavy dependencies.
 */
export function filterRoutesBySuite(
  config: { suites?: Record<string, { routes: string[] }>; capture: { routes: Array<{ path: string }> } },
  suiteName: string,
): typeof config {
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
  };
}

// ── Remote capture (API mode) ────────────────────────────────────────────────

export async function runRemoteCapture(options: CaptureOptions): Promise<DiffSummary> {
  const creds = await loadCredentials();
  if (!creds) {
    throw new Error(
      'Not authenticated. Run "sentinel login" first to use remote mode.'
    );
  }

  const client = new SentinelClient(creds);

  // Load and parse the local config file (YAML -> plain object)
  const configRaw = await readFile(options.config, 'utf-8');
  const configObj = parseYaml(configRaw);

  if (!configObj?.project) {
    throw new Error(`Invalid config: "project" field is required in ${options.config}`);
  }

  // If --suite is set, validate it exists locally
  if (options.suite && configObj.suites) {
    filterRoutesBySuite(configObj, options.suite);
  }

  // Ensure project exists on server
  const project = await client.ensureProject(configObj.project);

  // Trigger capture with inline config
  const { runId } = await client.triggerCapture({
    projectId: project.id,
    config: configObj,
    branchName: options.branch,
    commitSha: options.commitSha,
  });

  process.stderr.write(`Capture started (run: ${runId}). Waiting for completion...\n`);

  // Poll for completion
  const POLL_INTERVAL = 3000;
  const MAX_WAIT = 600_000;
  const start = Date.now();
  let lastStatus = '';

  while (Date.now() - start < MAX_WAIT) {
    const status = await client.getRunStatus(runId);

    if (status.status !== lastStatus) {
      process.stderr.write(`  Status: ${status.status}\n`);
      lastStatus = status.status;
    }

    if (status.status === 'completed' || status.status === 'partial') {
      break;
    }
    if (status.status === 'failed') {
      throw new Error(`Capture run failed on the server (run: ${runId})`);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  if (Date.now() - start >= MAX_WAIT) {
    throw new Error(`Capture timed out after ${MAX_WAIT / 1000}s (run: ${runId}). Check the dashboard for results.`);
  }

  // Fetch diffs
  const diffs = await client.getDiffs(runId);

  const diffEntries: DiffEntry[] = diffs.map((d) => ({
    url: d.snapshotUrl,
    viewport: d.snapshotViewport,
    pixelDiffPercent: d.pixelDiffPercent != null ? d.pixelDiffPercent / 100 : 0,
    ssimScore: d.ssimScore != null ? d.ssimScore / 10000 : null,
    passed: d.passed === 'true',
    diffS3Key: '',
  }));

  const failedCount = diffEntries.filter((d) => !d.passed).length;

  return {
    allPassed: failedCount === 0,
    failedCount,
    runId,
    diffs: diffEntries,
  };
}
