import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initLocalRuntime } from '../local-runtime.js';
import { localRouter } from '../local-router.js';

function createCaller(db: any) {
  return localRouter.createCaller({ db });
}

describe('local-router healthScores', () => {
  let tempDir: string;
  let runtime: Awaited<ReturnType<typeof initLocalRuntime>>;
  let caller: ReturnType<typeof createCaller>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-router-'));
    runtime = await initLocalRuntime(tempDir);
    caller = createCaller(runtime.db);

    // Seed project
    (runtime.db as any).$client.prepare(
      `INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)`,
    ).run('proj-1', 'Test Project', Date.now());
  });

  afterEach(async () => {
    runtime.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('projectScore returns latest project-level score', async () => {
    const db = (runtime.db as any).$client;
    const now = Date.now();
    db.prepare(
      `INSERT INTO health_scores (id, project_id, component_id, score, window_days, computed_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('hs-1', 'proj-1', null, 72, 30, now - 60000);
    db.prepare(
      `INSERT INTO health_scores (id, project_id, component_id, score, window_days, computed_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('hs-2', 'proj-1', null, 85, 30, now);

    const result = await caller.healthScores.projectScore({ projectId: 'proj-1' });
    expect(result).not.toBeNull();
    expect(result!.score).toBe(85);
  });

  it('projectScore returns null when no scores', async () => {
    const result = await caller.healthScores.projectScore({ projectId: 'proj-1' });
    expect(result).toBeNull();
  });

  it('componentScores returns sorted worst-first, excludes -1', async () => {
    const db = (runtime.db as any).$client;
    const now = Date.now();
    // Create components
    db.prepare(
      `INSERT INTO components (id, project_id, name, selector, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('comp-1', 'proj-1', 'Button', '.btn', 1, now, now);
    db.prepare(
      `INSERT INTO components (id, project_id, name, selector, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('comp-2', 'proj-1', 'Header', '.header', 1, now, now);
    db.prepare(
      `INSERT INTO components (id, project_id, name, selector, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('comp-3', 'proj-1', 'NoData', '.nodata', 1, now, now);

    // Scores: comp-1=90, comp-2=60, comp-3=-1 (no data)
    db.prepare(
      `INSERT INTO health_scores (id, project_id, component_id, score, window_days, computed_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('hs-a', 'proj-1', 'comp-1', 90, 30, now);
    db.prepare(
      `INSERT INTO health_scores (id, project_id, component_id, score, window_days, computed_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('hs-b', 'proj-1', 'comp-2', 60, 30, now);
    db.prepare(
      `INSERT INTO health_scores (id, project_id, component_id, score, window_days, computed_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('hs-c', 'proj-1', 'comp-3', -1, 30, now);

    const result = await caller.healthScores.componentScores({ projectId: 'proj-1' });
    expect(result).toHaveLength(2); // comp-3 excluded
    expect(result[0].score).toBe(60); // worst first
    expect(result[1].score).toBe(90);
  });

  it('trend returns scores within window, chronological order', async () => {
    const db = (runtime.db as any).$client;
    const now = Date.now();
    const day = 86400000;

    // Score from 3 days ago
    db.prepare(
      `INSERT INTO health_scores (id, project_id, component_id, score, window_days, computed_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('hs-t1', 'proj-1', null, 70, 30, now - 3 * day);
    // Score from 1 day ago
    db.prepare(
      `INSERT INTO health_scores (id, project_id, component_id, score, window_days, computed_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('hs-t2', 'proj-1', null, 80, 30, now - 1 * day);
    // Score from 40 days ago (outside 30-day window)
    db.prepare(
      `INSERT INTO health_scores (id, project_id, component_id, score, window_days, computed_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('hs-t3', 'proj-1', null, 50, 30, now - 40 * day);

    const result = await caller.healthScores.trend({ projectId: 'proj-1', windowDays: '30' });
    expect(result).toHaveLength(2);
    expect(result[0].score).toBe(70); // chronological: older first
    expect(result[1].score).toBe(80);
  });
});

describe('local-router stability', () => {
  let tempDir: string;
  let runtime: Awaited<ReturnType<typeof initLocalRuntime>>;
  let caller: ReturnType<typeof createCaller>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-router-'));
    runtime = await initLocalRuntime(tempDir);
    caller = createCaller(runtime.db);

    const db = (runtime.db as any).$client;
    const now = Date.now();
    const day = 86400000;

    // Seed project + run + snapshots + diffs
    db.prepare(`INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)`).run('proj-1', 'Test', now);
    db.prepare(`INSERT INTO capture_runs (id, project_id, status, created_at) VALUES (?, ?, ?, ?)`).run('run-1', 'proj-1', 'completed', now);
    db.prepare(`INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, parameter_name, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('snap-1', 'run-1', '/home', '1280x720', 'chromium', 'cap/s1.png', '', now);
    db.prepare(`INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, parameter_name, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('snap-2', 'run-1', '/home', '1280x720', 'chromium', 'cap/s2.png', '', now);

    // Diff results: pass then fail (1 flip)
    db.prepare(`INSERT INTO diff_reports (id, snapshot_id, baseline_s3_key, diff_s3_key, pixel_diff_percent, ssim_score, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('d-1', 'snap-1', 'b.png', 'd.png', 0, 10000, 'true', now - 2 * day);
    db.prepare(`INSERT INTO diff_reports (id, snapshot_id, baseline_s3_key, diff_s3_key, pixel_diff_percent, ssim_score, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('d-2', 'snap-2', 'b.png', 'd.png', 500, 9500, 'false', now - 1 * day);
  });

  afterEach(async () => {
    runtime.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('stability.list returns routes with scores', async () => {
    const result = await caller.stability.list({ projectId: 'proj-1' });
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('/home');
    expect(result[0].flipCount).toBe(1);
    expect(result[0].totalRuns).toBe(2);
    expect(result[0].stabilityScore).toBe(90); // 100 - 1*10
  });

  it('stability.flipHistory returns chronological pass/fail', async () => {
    const result = await caller.stability.flipHistory({
      projectId: 'proj-1',
      url: '/home',
      viewport: '1280x720',
      browser: 'chromium',
      parameterName: '',
    });
    expect(result).toHaveLength(2);
    expect(result[0].passed).toBe('true');
    expect(result[1].passed).toBe('false');
  });
});

describe('local-router analytics', () => {
  let tempDir: string;
  let runtime: Awaited<ReturnType<typeof initLocalRuntime>>;
  let caller: ReturnType<typeof createCaller>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-router-'));
    runtime = await initLocalRuntime(tempDir);
    caller = createCaller(runtime.db);

    const db = (runtime.db as any).$client;
    const now = Date.now();
    const day = 86400000;

    db.prepare(`INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)`).run('proj-1', 'Test', now);
    db.prepare(`INSERT INTO capture_runs (id, project_id, status, created_at) VALUES (?, ?, ?, ?)`).run('run-1', 'proj-1', 'completed', now - 2 * day);

    // Snapshots + diffs (one passed, one failed)
    db.prepare(`INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, parameter_name, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('snap-1', 'run-1', '/home', '1280x720', 'chromium', 'c/s1.png', '', now - 2 * day);
    db.prepare(`INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, parameter_name, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('snap-2', 'run-1', '/about', '1280x720', 'chromium', 'c/s2.png', '', now - 2 * day);

    db.prepare(`INSERT INTO diff_reports (id, snapshot_id, baseline_s3_key, diff_s3_key, pixel_diff_percent, ssim_score, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('d-1', 'snap-1', 'b.png', 'd.png', 0, 10000, 'true', now - 2 * day);
    db.prepare(`INSERT INTO diff_reports (id, snapshot_id, baseline_s3_key, diff_s3_key, pixel_diff_percent, ssim_score, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('d-2', 'snap-2', 'b.png', 'd.png', 500, 9500, 'false', now - 2 * day);

    // Approval for the failed diff
    db.prepare(`INSERT INTO approval_decisions (id, diff_report_id, action, user_id, user_email, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('ap-1', 'd-2', 'approved', 'local', 'local', null, now - 1 * day);
  });

  afterEach(async () => {
    runtime.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('regressionTrend returns daily counts of failed diffs', async () => {
    const result = await caller.analytics.regressionTrend({ projectId: 'proj-1', windowDays: '30' });
    expect(result.length).toBeGreaterThanOrEqual(1);
    const total = result.reduce((sum: number, r: any) => sum + r.count, 0);
    expect(total).toBe(1); // one failed diff
  });

  it('teamMetrics returns approval stats', async () => {
    const result = await caller.analytics.teamMetrics({ projectId: 'proj-1', windowDays: '30' });
    expect(result.totalApprovals).toBe(1);
    expect(result.meanTimeToApproveMs).toBeGreaterThan(0);
    expect(result.approvalVelocity).toBeGreaterThan(0);
  });

  it('diffExport returns flat rows with approval data', async () => {
    const result = await caller.analytics.diffExport({ projectId: 'proj-1', windowDays: '30' });
    expect(result).toHaveLength(2); // two diffs
    const approved = result.find((r: any) => r.approvalAction === 'approved');
    expect(approved).toBeDefined();
    expect(approved!.url).toBe('/about');
  });
});

describe('local-router lighthouse', () => {
  let tempDir: string;
  let runtime: Awaited<ReturnType<typeof initLocalRuntime>>;
  let caller: ReturnType<typeof createCaller>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-router-'));
    runtime = await initLocalRuntime(tempDir);
    caller = createCaller(runtime.db);

    const db = (runtime.db as any).$client;
    const now = Date.now();
    const day = 86400000;

    db.prepare(`INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)`).run('proj-1', 'Test', now);
    db.prepare(`INSERT INTO capture_runs (id, project_id, status, created_at) VALUES (?, ?, ?, ?)`).run('run-1', 'proj-1', 'completed', now - 2 * day);
    db.prepare(`INSERT INTO capture_runs (id, project_id, status, created_at) VALUES (?, ?, ?, ?)`).run('run-2', 'proj-1', 'completed', now - 1 * day);

    // Lighthouse scores for two runs
    db.prepare(`INSERT INTO lighthouse_scores (id, capture_run_id, project_id, url, viewport, performance, accessibility, best_practices, seo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('lh-1', 'run-1', 'proj-1', '/home', '1280x720', 85, 90, 80, 95, now - 2 * day);
    db.prepare(`INSERT INTO lighthouse_scores (id, capture_run_id, project_id, url, viewport, performance, accessibility, best_practices, seo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('lh-2', 'run-2', 'proj-1', '/home', '1280x720', 88, 92, 82, 96, now - 1 * day);
    db.prepare(`INSERT INTO lighthouse_scores (id, capture_run_id, project_id, url, viewport, performance, accessibility, best_practices, seo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('lh-3', 'run-1', 'proj-1', '/about', '1280x720', 75, 85, 78, 90, now - 2 * day);

    // Budget
    db.prepare(`INSERT INTO performance_budgets (id, project_id, route, performance, accessibility, best_practices, seo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('pb-1', 'proj-1', '/home', 80, 85, 75, 90, now, now);
  });

  afterEach(async () => {
    runtime.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('routeUrls returns distinct URLs with lighthouse data', async () => {
    const result = await caller.lighthouse.routeUrls({ projectId: 'proj-1' });
    expect(result).toHaveLength(2);
    const urls = result.map((r: any) => r.url).sort();
    expect(urls).toEqual(['/about', '/home']);
  });

  it('trend returns chronological scores for a route', async () => {
    const result = await caller.lighthouse.trend({ projectId: 'proj-1', url: '/home' });
    expect(result).toHaveLength(2);
    expect(result[0].performance).toBe(85); // older first
    expect(result[1].performance).toBe(88);
  });

  it('budgetsList returns budgets for project', async () => {
    const result = await caller.lighthouse.budgetsList({ projectId: 'proj-1' });
    expect(result).toHaveLength(1);
    expect(result[0].route).toBe('/home');
    expect(result[0].performance).toBe(80);
  });
});

describe('local-router components CRUD + consistency', () => {
  let tempDir: string;
  let runtime: Awaited<ReturnType<typeof initLocalRuntime>>;
  let caller: ReturnType<typeof createCaller>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-router-'));
    runtime = await initLocalRuntime(tempDir);
    caller = createCaller(runtime.db);

    const db = (runtime.db as any).$client;
    const now = Date.now();
    db.prepare(`INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)`).run('proj-1', 'Test', now);
  });

  afterEach(async () => {
    runtime.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('create inserts a component', async () => {
    const result = await caller.components.create({
      projectId: 'proj-1',
      name: 'Button',
      selector: '.btn',
      description: 'Primary button',
    });
    expect(result.name).toBe('Button');
    expect(result.selector).toBe('.btn');
    expect(result.id).toBeDefined();
  });

  it('update toggles enabled status', async () => {
    const created = await caller.components.create({
      projectId: 'proj-1',
      name: 'Nav',
      selector: '.nav',
    });
    const updated = await caller.components.update({ id: created.id, enabled: 0 });
    expect(updated.enabled).toBe(0);
  });

  it('delete removes a component', async () => {
    const created = await caller.components.create({
      projectId: 'proj-1',
      name: 'Footer',
      selector: '.footer',
    });
    const result = await caller.components.delete({ id: created.id });
    expect(result.success).toBe(true);

    const list = await caller.components.list({ projectId: 'proj-1' });
    expect((list as any[]).length).toBe(0);
  });

  it('consistency returns component status by URL', async () => {
    const db = (runtime.db as any).$client;
    const now = Date.now();

    // Create component
    db.prepare(
      `INSERT INTO components (id, project_id, name, selector, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('comp-1', 'proj-1', 'Header', '.header', 1, now, now);

    // Create run + snapshots with component_id
    db.prepare(`INSERT INTO capture_runs (id, project_id, status, created_at) VALUES (?, ?, ?, ?)`).run('run-1', 'proj-1', 'completed', now);
    db.prepare(`INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, parameter_name, component_id, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('snap-1', 'run-1', '/home', '1280x720', 'chromium', 'c/s1.png', '', 'comp-1', now);
    db.prepare(`INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, parameter_name, component_id, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('snap-2', 'run-1', '/about', '1280x720', 'chromium', 'c/s2.png', '', 'comp-1', now);

    // Also create page-level snapshots (no component_id) so project URLs exist
    db.prepare(`INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, parameter_name, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('snap-3', 'run-1', '/home', '1280x720', 'chromium', 'c/s3.png', '', now);
    db.prepare(`INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, parameter_name, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('snap-4', 'run-1', '/about', '1280x720', 'chromium', 'c/s4.png', '', now);

    const result = await caller.components.consistency({ projectId: 'proj-1' });
    expect(result).toHaveLength(1);
    expect(result[0].componentName).toBe('Header');
    expect(result[0].pages).toHaveLength(2);
  });
});

describe('local-router approvals.bulkApprove', () => {
  let tempDir: string;
  let runtime: Awaited<ReturnType<typeof initLocalRuntime>>;
  let caller: ReturnType<typeof createCaller>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-router-'));
    runtime = await initLocalRuntime(tempDir);
    caller = createCaller(runtime.db);

    const db = (runtime.db as any).$client;
    const now = Date.now();
    db.prepare(`INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)`).run('proj-1', 'Test', now);
    db.prepare(`INSERT INTO capture_runs (id, project_id, status, created_at) VALUES (?, ?, ?, ?)`).run('run-1', 'proj-1', 'completed', now);
    db.prepare(`INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, parameter_name, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('snap-1', 'run-1', '/home', '1280x720', 'chromium', 'c/s1.png', '', now);
    db.prepare(`INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, parameter_name, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('snap-2', 'run-1', '/about', '1280x720', 'chromium', 'c/s2.png', '', now);

    // Two failed diffs
    db.prepare(`INSERT INTO diff_reports (id, snapshot_id, baseline_s3_key, diff_s3_key, pixel_diff_percent, ssim_score, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('d-1', 'snap-1', 'b.png', 'd.png', 500, 9500, 'false', now);
    db.prepare(`INSERT INTO diff_reports (id, snapshot_id, baseline_s3_key, diff_s3_key, pixel_diff_percent, ssim_score, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('d-2', 'snap-2', 'b.png', 'd.png', 300, 9700, 'false', now);
  });

  afterEach(async () => {
    runtime.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('bulkApprove approves all failed diffs in a run', async () => {
    const result = await caller.approvals.bulkApprove({ runId: 'run-1' });
    expect(result.approvedCount).toBe(2);

    // Verify both are now passed
    const diffs = await caller.diffs.byRunId({ runId: 'run-1' });
    expect(diffs.every((d: any) => d.passed === 'passed')).toBe(true);
  });
});

describe('local-router classifications.override', () => {
  let tempDir: string;
  let runtime: Awaited<ReturnType<typeof initLocalRuntime>>;
  let caller: ReturnType<typeof createCaller>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-router-'));
    runtime = await initLocalRuntime(tempDir);
    caller = createCaller(runtime.db);

    const db = (runtime.db as any).$client;
    const now = Date.now();
    db.prepare(`INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)`).run('proj-1', 'Test', now);
    db.prepare(`INSERT INTO capture_runs (id, project_id, status, created_at) VALUES (?, ?, ?, ?)`).run('run-1', 'proj-1', 'completed', now);
    db.prepare(`INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, parameter_name, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('snap-1', 'run-1', '/home', '1280x720', 'chromium', 'c/s1.png', '', now);
    db.prepare(`INSERT INTO diff_reports (id, snapshot_id, baseline_s3_key, diff_s3_key, pixel_diff_percent, ssim_score, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('d-1', 'snap-1', 'b.png', 'd.png', 500, 9500, 'false', now);
    db.prepare(`INSERT INTO diff_classifications (id, diff_report_id, category, confidence, created_at) VALUES (?, ?, ?, ?, ?)`).run('dc-1', 'd-1', 'layout', 85, now);
  });

  afterEach(async () => {
    runtime.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('override stores original and new category', async () => {
    const result = await caller.classifications.override({
      diffReportId: 'd-1',
      overrideCategory: 'cosmetic',
    });
    expect(result.success).toBe(true);

    // Verify override was stored
    const override = (runtime.db as any).$client.prepare(
      `SELECT * FROM classification_overrides WHERE diff_report_id = ?`,
    ).get('d-1') as any;
    expect(override.original_category).toBe('layout');
    expect(override.override_category).toBe('cosmetic');
  });
});

describe('health score computation', () => {
  it('computes project health score from diff pass rates', async () => {
    const { computeAndStoreHealthScores } = await import('../health-score-compute.js');

    const tempDir = await mkdtemp(join(tmpdir(), 'sentinel-health-'));
    const runtime = await initLocalRuntime(tempDir);
    const db = (runtime.db as any).$client;
    const now = Date.now();

    db.prepare(`INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)`).run('proj-1', 'Test', now);
    db.prepare(`INSERT INTO capture_runs (id, project_id, status, created_at) VALUES (?, ?, ?, ?)`).run('run-1', 'proj-1', 'completed', now);

    // 3 snapshots: 2 pass, 1 fail
    for (let i = 1; i <= 3; i++) {
      db.prepare(`INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, parameter_name, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(`snap-${i}`, 'run-1', `/page-${i}`, '1280x720', 'chromium', `c/s${i}.png`, '', now);
      db.prepare(`INSERT INTO diff_reports (id, snapshot_id, baseline_s3_key, diff_s3_key, pixel_diff_percent, ssim_score, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(`d-${i}`, `snap-${i}`, 'b.png', 'd.png', i === 3 ? 500 : 0, i === 3 ? 9500 : 10000, i === 3 ? 'false' : 'true', now);
    }

    computeAndStoreHealthScores(runtime.db, 'proj-1');

    const caller = createCaller(runtime.db);
    const score = await caller.healthScores.projectScore({ projectId: 'proj-1' });
    expect(score).not.toBeNull();
    // 2 out of 3 passed = 67% health
    expect(score!.score).toBe(67);

    runtime.close();
    await rm(tempDir, { recursive: true, force: true });
  });
});
