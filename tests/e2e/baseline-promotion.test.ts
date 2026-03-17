import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import {
  setupE2eInfra,
  teardownE2eInfra,
  type E2eInfra,
} from './setup.js';
import { sqliteSchema } from '@sentinel-vrt/db';
import { StorageKeys } from '@sentinel-vrt/storage';

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

// A slightly different PNG to simulate a visual diff (1x1 red pixel)
const RED_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQI12P4z8BQDwAE' +
    'gAF/QualEQAAAABJRU5ErkJggg==',
  'base64',
);

const PROJECT_NAME = 'e2e-baseline-promotion';
const TEST_URL = 'https://example.com/page';
const VIEWPORT_DESKTOP = '1280x720';
const VIEWPORT_MOBILE = '375x812';

describe('Baseline Promotion (E2E)', () => {
  let infra: E2eInfra;
  let projectId: string;
  let firstRunId: string;
  let secondRunId: string;
  let firstSnapshotId: string;
  let secondSnapshotId: string;
  let firstBaselineId: string;
  let secondBaselineId: string;
  let diffReportId: string;

  beforeAll(async () => {
    infra = await setupE2eInfra();
  });

  afterAll(async () => {
    await teardownE2eInfra(infra.tempDir);
  });

  // -----------------------------------------------------------------------
  // 1. Create project and initial capture
  // -----------------------------------------------------------------------
  it('creates project and initial capture run with snapshot', async () => {
    // Project
    const [proj] = infra.db
      .insert(projects)
      .values({ name: PROJECT_NAME })
      .returning().all();
    expect(proj).toBeDefined();
    projectId = proj.id;

    // First capture run
    const [run] = infra.db
      .insert(captureRuns)
      .values({
        projectId,
        status: 'completed',
        source: 'manual',
        commitSha: 'base111',
        branchName: 'main',
      })
      .returning().all();
    firstRunId = run.id;

    // First snapshot
    const storageKey = StorageKeys.capture(firstRunId, 'placeholder');
    const [snap] = infra.db
      .insert(snapshots)
      .values({
        runId: firstRunId,
        url: TEST_URL,
        viewport: VIEWPORT_DESKTOP,
        browser: 'chromium',
        storageKey,
      })
      .returning().all();
    firstSnapshotId = snap.id;

    // Upload image and update storageKey
    const realKey = StorageKeys.capture(firstRunId, firstSnapshotId);
    await infra.storage.upload(realKey, TINY_PNG, 'image/png');
    infra.db
      .update(snapshots)
      .set({ storageKey: realKey })
      .where(eq(snapshots.id, firstSnapshotId))
      .run();
  });

  // -----------------------------------------------------------------------
  // 2. Create initial baseline from first capture
  // -----------------------------------------------------------------------
  it('creates initial baseline from first capture', async () => {
    const baselineKey = StorageKeys.baseline(projectId, firstSnapshotId);
    await infra.storage.upload(baselineKey, TINY_PNG, 'image/png');

    const [baseline] = infra.db
      .insert(baselines)
      .values({
        projectId,
        url: TEST_URL,
        viewport: VIEWPORT_DESKTOP,
        browser: 'chromium',
        storageKey: baselineKey,
        snapshotId: firstSnapshotId,
        approvedBy: 'e2e-initial',
      })
      .returning().all();

    expect(baseline).toBeDefined();
    expect(baseline.projectId).toBe(projectId);
    expect(baseline.snapshotId).toBe(firstSnapshotId);
    firstBaselineId = baseline.id;
  });

  // -----------------------------------------------------------------------
  // 3. Create second capture with a visual diff
  // -----------------------------------------------------------------------
  it('creates second capture with a different image', async () => {
    // Second capture run
    const [run] = infra.db
      .insert(captureRuns)
      .values({
        projectId,
        status: 'completed',
        source: 'manual',
        commitSha: 'diff222',
        branchName: 'main',
      })
      .returning().all();
    secondRunId = run.id;

    // Second snapshot (different image)
    const storageKey = StorageKeys.capture(secondRunId, 'placeholder');
    const [snap] = infra.db
      .insert(snapshots)
      .values({
        runId: secondRunId,
        url: TEST_URL,
        viewport: VIEWPORT_DESKTOP,
        browser: 'chromium',
        storageKey,
      })
      .returning().all();
    secondSnapshotId = snap.id;

    // Upload the "changed" image
    const realKey = StorageKeys.capture(secondRunId, secondSnapshotId);
    await infra.storage.upload(realKey, RED_PNG, 'image/png');
    infra.db
      .update(snapshots)
      .set({ storageKey: realKey })
      .where(eq(snapshots.id, secondSnapshotId))
      .run();
  });

  // -----------------------------------------------------------------------
  // 4. Create a diff report comparing second snapshot to first baseline
  // -----------------------------------------------------------------------
  it('creates a diff report comparing new capture to existing baseline', async () => {
    const baselineKey = StorageKeys.baseline(projectId, firstSnapshotId);
    const diffKey = StorageKeys.diff(secondRunId, secondSnapshotId);
    await infra.storage.upload(diffKey, RED_PNG, 'image/png');

    const [diff] = infra.db
      .insert(diffReports)
      .values({
        snapshotId: secondSnapshotId,
        baselineStorageKey: baselineKey,
        diffStorageKey: diffKey,
        pixelDiffPercent: 1000, // 10%
        ssimScore: 8800,
        passed: 'false',
      })
      .returning().all();

    expect(diff).toBeDefined();
    expect(diff.passed).toBe('false');
    expect(diff.pixelDiffPercent).toBe(1000);
    diffReportId = diff.id;
  });

  // -----------------------------------------------------------------------
  // 5. Approve the diff and promote to new baseline
  // -----------------------------------------------------------------------
  it('approves the diff and promotes to new baseline', async () => {
    // Record approval
    const [decision] = infra.db
      .insert(approvalDecisions)
      .values({
        diffReportId,
        action: 'approved',
        userId: 'user-e2e-promote',
        userEmail: 'promote@example.com',
        reason: 'Intentional redesign',
      })
      .returning().all();
    expect(decision.action).toBe('approved');

    // Create new baseline from the approved snapshot
    const newBaselineKey = StorageKeys.baseline(projectId, secondSnapshotId);
    await infra.storage.upload(newBaselineKey, RED_PNG, 'image/png');

    const [newBaseline] = infra.db
      .insert(baselines)
      .values({
        projectId,
        url: TEST_URL,
        viewport: VIEWPORT_DESKTOP,
        browser: 'chromium',
        storageKey: newBaselineKey,
        snapshotId: secondSnapshotId,
        approvedBy: 'user-e2e-promote',
      })
      .returning().all();

    expect(newBaseline).toBeDefined();
    expect(newBaseline.snapshotId).toBe(secondSnapshotId);
    secondBaselineId = newBaseline.id;
  });

  // -----------------------------------------------------------------------
  // 6. Verify old baseline still exists but new one is latest
  // -----------------------------------------------------------------------
  it('old baseline still exists and new baseline is more recent', async () => {
    // Both baselines should exist
    const allBaselines = infra.db
      .select()
      .from(baselines)
      .where(
        and(
          eq(baselines.projectId, projectId),
          eq(baselines.url, TEST_URL),
          eq(baselines.viewport, VIEWPORT_DESKTOP),
          eq(baselines.browser, 'chromium'),
        ),
      )
      .all();

    expect(allBaselines.length).toBe(2);

    // Both baselines should be present (order may vary with same-second timestamps)
    const ids = allBaselines.map((b) => b.id);
    expect(ids).toContain(firstBaselineId);
    expect(ids).toContain(secondBaselineId);

    const latest = allBaselines.find((b) => b.id === secondBaselineId)!;
    expect(latest.snapshotId).toBe(secondSnapshotId);

    const older = allBaselines.find((b) => b.id === firstBaselineId)!;
    expect(older.snapshotId).toBe(firstSnapshotId);

    // Verify the storage objects are distinct
    const latestBuf = await infra.storage.download(latest.storageKey);
    const olderBuf = await infra.storage.download(older.storageKey);

    expect(latestBuf.length).toBeGreaterThan(0);
    expect(olderBuf.length).toBeGreaterThan(0);
    // The two baselines have different images
    expect(Buffer.compare(latestBuf, olderBuf)).not.toBe(0);
  });

  // -----------------------------------------------------------------------
  // 7. Test baselines for different viewports
  // -----------------------------------------------------------------------
  it('creates separate baselines for different viewports', async () => {
    // Create a mobile snapshot for the same URL
    const mobileStorageKey = StorageKeys.capture(firstRunId, 'mobile-placeholder');
    const [mobileSnap] = infra.db
      .insert(snapshots)
      .values({
        runId: firstRunId,
        url: TEST_URL,
        viewport: VIEWPORT_MOBILE,
        browser: 'chromium',
        storageKey: mobileStorageKey,
      })
      .returning().all();

    const mobileRealKey = StorageKeys.capture(firstRunId, mobileSnap.id);
    await infra.storage.upload(mobileRealKey, TINY_PNG, 'image/png');
    infra.db
      .update(snapshots)
      .set({ storageKey: mobileRealKey })
      .where(eq(snapshots.id, mobileSnap.id))
      .run();

    // Create a mobile baseline
    const mobileBaselineKey = StorageKeys.baseline(projectId, mobileSnap.id);
    await infra.storage.upload(mobileBaselineKey, TINY_PNG, 'image/png');

    const [mobileBaseline] = infra.db
      .insert(baselines)
      .values({
        projectId,
        url: TEST_URL,
        viewport: VIEWPORT_MOBILE,
        browser: 'chromium',
        storageKey: mobileBaselineKey,
        snapshotId: mobileSnap.id,
        approvedBy: 'e2e-mobile',
      })
      .returning().all();

    expect(mobileBaseline).toBeDefined();
    expect(mobileBaseline.viewport).toBe(VIEWPORT_MOBILE);

    // Desktop baselines should be unaffected
    const desktopBaselines = infra.db
      .select()
      .from(baselines)
      .where(
        and(
          eq(baselines.projectId, projectId),
          eq(baselines.viewport, VIEWPORT_DESKTOP),
        ),
      )
      .all();
    expect(desktopBaselines.length).toBe(2); // first + promoted

    // Mobile baselines should have exactly one
    const mobileBaselines = infra.db
      .select()
      .from(baselines)
      .where(
        and(
          eq(baselines.projectId, projectId),
          eq(baselines.viewport, VIEWPORT_MOBILE),
        ),
      )
      .all();
    expect(mobileBaselines.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 8. Test baselines for different browsers
  // -----------------------------------------------------------------------
  it('creates separate baselines for different browsers', async () => {
    // Create a Firefox snapshot
    const firefoxStorageKey = StorageKeys.capture(firstRunId, 'firefox-placeholder');
    const [firefoxSnap] = infra.db
      .insert(snapshots)
      .values({
        runId: firstRunId,
        url: TEST_URL,
        viewport: VIEWPORT_DESKTOP,
        browser: 'firefox',
        storageKey: firefoxStorageKey,
      })
      .returning().all();

    const firefoxRealKey = StorageKeys.capture(firstRunId, firefoxSnap.id);
    await infra.storage.upload(firefoxRealKey, TINY_PNG, 'image/png');
    infra.db
      .update(snapshots)
      .set({ storageKey: firefoxRealKey })
      .where(eq(snapshots.id, firefoxSnap.id))
      .run();

    // Create a Firefox baseline
    const firefoxBaselineKey = StorageKeys.baseline(projectId, firefoxSnap.id);
    await infra.storage.upload(firefoxBaselineKey, TINY_PNG, 'image/png');

    const [firefoxBaseline] = infra.db
      .insert(baselines)
      .values({
        projectId,
        url: TEST_URL,
        viewport: VIEWPORT_DESKTOP,
        browser: 'firefox',
        storageKey: firefoxBaselineKey,
        snapshotId: firefoxSnap.id,
        approvedBy: 'e2e-firefox',
      })
      .returning().all();

    expect(firefoxBaseline).toBeDefined();
    expect(firefoxBaseline.browser).toBe('firefox');

    // Chromium desktop baselines should be unaffected
    const chromiumBaselines = infra.db
      .select()
      .from(baselines)
      .where(
        and(
          eq(baselines.projectId, projectId),
          eq(baselines.viewport, VIEWPORT_DESKTOP),
          eq(baselines.browser, 'chromium'),
        ),
      )
      .all();
    expect(chromiumBaselines.length).toBe(2); // first + promoted

    // Firefox desktop baselines should have exactly one
    const firefoxBaselines = infra.db
      .select()
      .from(baselines)
      .where(
        and(
          eq(baselines.projectId, projectId),
          eq(baselines.viewport, VIEWPORT_DESKTOP),
          eq(baselines.browser, 'firefox'),
        ),
      )
      .all();
    expect(firefoxBaselines.length).toBe(1);
    expect(firefoxBaselines[0]!.snapshotId).toBe(firefoxSnap.id);
  });
});
