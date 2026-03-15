import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  setupE2eInfra,
  teardownE2eInfra,
  type E2eInfra,
} from './setup.js';
import { sqliteSchema } from '@sentinel/db';
import { StorageKeys } from '@sentinel/storage';

const {
  projects,
  captureRuns,
  snapshots,
  baselines,
  diffReports,
  approvalDecisions,
} = sqliteSchema;

// Minimal valid 1x1 transparent PNG (67 bytes)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
    'Nl7BcQAAAABJRU5ErkJggg==',
  'base64',
);

const PROJECT_NAME = 'e2e-approval-workflow';
const TEST_URL = 'https://example.com/dashboard';
const TEST_VIEWPORT = '1280x720';

describe('Approval Workflow (E2E)', () => {
  let infra: E2eInfra;
  let projectId: string;
  let runId: string;
  let snapshotId: string;
  let diffReportId: string;
  let secondSnapshotId: string;
  let secondDiffReportId: string;

  beforeAll(async () => {
    infra = await setupE2eInfra();
  });

  afterAll(async () => {
    await teardownE2eInfra(infra.tempDir);
  });

  // -----------------------------------------------------------------------
  // 1. Create project, run, snapshot, and a failing diff report
  // -----------------------------------------------------------------------
  it('creates project, run, snapshot, and failing diff report', async () => {
    // Project
    const [proj] = infra.db
      .insert(projects)
      .values({ name: PROJECT_NAME })
      .returning().all();
    expect(proj).toBeDefined();
    projectId = proj.id;

    // Capture run
    const [run] = infra.db
      .insert(captureRuns)
      .values({
        projectId,
        status: 'running',
        source: 'manual',
        commitSha: 'def456',
        branchName: 'feature/redesign',
      })
      .returning().all();
    expect(run).toBeDefined();
    runId = run.id;

    // Snapshot
    const storageKey = StorageKeys.capture(runId, 'placeholder');
    const [snap] = infra.db
      .insert(snapshots)
      .values({
        runId,
        url: TEST_URL,
        viewport: TEST_VIEWPORT,
        browser: 'chromium',
        storageKey,
      })
      .returning().all();
    expect(snap).toBeDefined();
    snapshotId = snap.id;

    // Upload capture image with real key
    const realKey = StorageKeys.capture(runId, snapshotId);
    await infra.storage.upload(realKey, TINY_PNG, 'image/png');
    infra.db
      .update(snapshots)
      .set({ storageKey: realKey })
      .where(eq(snapshots.id, snapshotId))
      .run();

    // Baseline (existing) for comparison
    const baselineKey = StorageKeys.baseline(projectId, snapshotId);
    await infra.storage.upload(baselineKey, TINY_PNG, 'image/png');

    // Failing diff report (5% pixel difference)
    const diffKey = StorageKeys.diff(runId, snapshotId);
    await infra.storage.upload(diffKey, TINY_PNG, 'image/png');

    const [diff] = infra.db
      .insert(diffReports)
      .values({
        snapshotId,
        baselineStorageKey: baselineKey,
        diffStorageKey: diffKey,
        pixelDiffPercent: 500, // 5%
        ssimScore: 9200,
        passed: 'false',
      })
      .returning().all();

    expect(diff).toBeDefined();
    expect(diff.passed).toBe('false');
    expect(diff.pixelDiffPercent).toBe(500);
    diffReportId = diff.id;
  });

  // -----------------------------------------------------------------------
  // 2. Record an approval decision for the diff
  // -----------------------------------------------------------------------
  it('records an approval decision for the diff', async () => {
    const [decision] = infra.db
      .insert(approvalDecisions)
      .values({
        diffReportId,
        action: 'approved',
        userId: 'user-e2e',
        userEmail: 'test@example.com',
        reason: 'Intentional change',
      })
      .returning().all();

    expect(decision).toBeDefined();
    expect(decision.diffReportId).toBe(diffReportId);
    expect(decision.action).toBe('approved');
    expect(decision.userId).toBe('user-e2e');
    expect(decision.userEmail).toBe('test@example.com');
    expect(decision.reason).toBe('Intentional change');
    expect(decision.createdAt).toBeInstanceOf(Date);
  });

  // -----------------------------------------------------------------------
  // 3. Create a new baseline after approval
  // -----------------------------------------------------------------------
  it('creates a new baseline after approval', async () => {
    const baselineKey = StorageKeys.baseline(projectId, snapshotId);
    await infra.storage.upload(baselineKey, TINY_PNG, 'image/png');

    const [baseline] = infra.db
      .insert(baselines)
      .values({
        projectId,
        url: TEST_URL,
        viewport: TEST_VIEWPORT,
        browser: 'chromium',
        storageKey: baselineKey,
        snapshotId,
        approvedBy: 'user-e2e',
      })
      .returning().all();

    expect(baseline).toBeDefined();
    expect(baseline.projectId).toBe(projectId);
    expect(baseline.snapshotId).toBe(snapshotId);
    expect(baseline.approvedBy).toBe('user-e2e');
  });

  // -----------------------------------------------------------------------
  // 4. Record a rejection decision for a second diff
  // -----------------------------------------------------------------------
  it('records a rejection decision for a second diff', async () => {
    // Create a second snapshot
    const storageKey2 = StorageKeys.capture(runId, 'placeholder2');
    const [snap2] = infra.db
      .insert(snapshots)
      .values({
        runId,
        url: TEST_URL + '/settings',
        viewport: TEST_VIEWPORT,
        browser: 'chromium',
        storageKey: storageKey2,
      })
      .returning().all();
    expect(snap2).toBeDefined();
    secondSnapshotId = snap2.id;

    // Upload capture image
    const realKey2 = StorageKeys.capture(runId, secondSnapshotId);
    await infra.storage.upload(realKey2, TINY_PNG, 'image/png');
    infra.db
      .update(snapshots)
      .set({ storageKey: realKey2 })
      .where(eq(snapshots.id, secondSnapshotId))
      .run();

    // Create a second failing diff report
    const baselineKey2 = StorageKeys.baseline(projectId, secondSnapshotId);
    const diffKey2 = StorageKeys.diff(runId, secondSnapshotId);
    await infra.storage.upload(baselineKey2, TINY_PNG, 'image/png');
    await infra.storage.upload(diffKey2, TINY_PNG, 'image/png');

    const [diff2] = infra.db
      .insert(diffReports)
      .values({
        snapshotId: secondSnapshotId,
        baselineStorageKey: baselineKey2,
        diffStorageKey: diffKey2,
        pixelDiffPercent: 1200, // 12%
        ssimScore: 8500,
        passed: 'false',
      })
      .returning().all();
    expect(diff2).toBeDefined();
    secondDiffReportId = diff2.id;

    // Record a rejection decision
    const [rejection] = infra.db
      .insert(approvalDecisions)
      .values({
        diffReportId: secondDiffReportId,
        action: 'rejected',
        userId: 'user-e2e',
        userEmail: 'test@example.com',
        reason: 'Visual regression',
      })
      .returning().all();

    expect(rejection).toBeDefined();
    expect(rejection.diffReportId).toBe(secondDiffReportId);
    expect(rejection.action).toBe('rejected');
    expect(rejection.reason).toBe('Visual regression');
  });

  // -----------------------------------------------------------------------
  // 5. Query approval history for the run
  // -----------------------------------------------------------------------
  it('queries approval history for the run', async () => {
    // Get all snapshots for this run
    const runSnapshots = infra.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.runId, runId)).all();

    expect(runSnapshots.length).toBe(2);

    const snapshotIds = runSnapshots.map((s) => s.id);

    // Get all diff reports for these snapshots
    const allDiffs = infra.db
      .select()
      .from(diffReports)
      .where(eq(diffReports.snapshotId, snapshotIds[0]!)).all();

    const allDiffs2 = infra.db
      .select()
      .from(diffReports)
      .where(eq(diffReports.snapshotId, snapshotIds[1]!)).all();

    const diffIds = [...allDiffs, ...allDiffs2].map((d) => d.id);
    expect(diffIds.length).toBe(2);

    // Get approval decisions for first diff
    const decisions1 = infra.db
      .select()
      .from(approvalDecisions)
      .where(eq(approvalDecisions.diffReportId, diffReportId)).all();

    // Get approval decisions for second diff
    const decisions2 = infra.db
      .select()
      .from(approvalDecisions)
      .where(eq(approvalDecisions.diffReportId, secondDiffReportId)).all();

    const allDecisions = [...decisions1, ...decisions2];
    expect(allDecisions.length).toBe(2);

    const approved = allDecisions.find((d) => d.action === 'approved');
    const rejected = allDecisions.find((d) => d.action === 'rejected');

    expect(approved).toBeDefined();
    expect(approved!.reason).toBe('Intentional change');
    expect(approved!.diffReportId).toBe(diffReportId);

    expect(rejected).toBeDefined();
    expect(rejected!.reason).toBe('Visual regression');
    expect(rejected!.diffReportId).toBe(secondDiffReportId);
  });

  // -----------------------------------------------------------------------
  // 6. Mark run as completed
  // -----------------------------------------------------------------------
  it('marks run as completed', async () => {
    const completedAt = new Date();

    infra.db
      .update(captureRuns)
      .set({ status: 'completed', completedAt })
      .where(eq(captureRuns.id, runId))
      .run();

    const [updated] = infra.db
      .select()
      .from(captureRuns)
      .where(eq(captureRuns.id, runId)).all();

    expect(updated.status).toBe('completed');
    expect(updated.completedAt).toBeDefined();
  });
});
