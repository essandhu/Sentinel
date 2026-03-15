import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  setupE2eInfra,
  teardownE2eInfra,
  type E2eInfra,
} from './setup.js';
import { cleanupTestData } from './helpers.js';
import { sqliteSchema } from '@sentinel/db';
import { StorageKeys } from '@sentinel/storage';

const {
  projects,
  captureRuns,
  snapshots,
  baselines,
  diffReports,
} = sqliteSchema;

// Minimal valid 1x1 transparent PNG (67 bytes)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
    'Nl7BcQAAAABJRU5ErkJggg==',
  'base64',
);

const PROJECT_NAME = 'e2e-capture-pipeline';
const TEST_URL = 'https://example.com/home';
const TEST_VIEWPORT = '1280x720';

describe('Capture-to-Diff Pipeline (E2E)', () => {
  let infra: E2eInfra;
  let projectId: string;
  let runId: string;
  let snapshotId: string;
  let baselineId: string;
  let diffReportId: string;

  beforeAll(async () => {
    infra = await setupE2eInfra();
  });

  afterAll(async () => {
    await teardownE2eInfra(infra.tempDir);
  });

  // -----------------------------------------------------------------------
  // 1. Create a project
  // -----------------------------------------------------------------------
  it('creates a project in the database', async () => {

    const [row] = infra.db
      .insert(projects)
      .values({ name: PROJECT_NAME })
      .returning().all();

    expect(row).toBeDefined();
    expect(row.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(row.name).toBe(PROJECT_NAME);
    projectId = row.id;
  });

  // -----------------------------------------------------------------------
  // 2. Create a capture run linked to the project
  // -----------------------------------------------------------------------
  it('creates a capture run linked to the project', async () => {

    const [row] = infra.db
      .insert(captureRuns)
      .values({
        projectId,
        status: 'running',
        source: 'manual',
        commitSha: 'abc123',
        branchName: 'main',
      })
      .returning().all();

    expect(row).toBeDefined();
    expect(row.projectId).toBe(projectId);
    expect(row.status).toBe('running');
    runId = row.id;
  });

  // -----------------------------------------------------------------------
  // 3. Upload a screenshot to storage and retrieve it
  // -----------------------------------------------------------------------
  it('uploads a screenshot to storage and retrieves it', async () => {

    // Use a temporary snapshot id for the storage key
    const tempSnapId = '00000000-0000-0000-0000-000000000001';
    const key = StorageKeys.capture(runId, tempSnapId);

    await infra.storage.upload(key, TINY_PNG, 'image/png');

    const downloaded = await infra.storage.download(key);
    expect(Buffer.compare(downloaded, TINY_PNG)).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 4. Insert a snapshot record in the database
  // -----------------------------------------------------------------------
  it('inserts a snapshot record in the database', async () => {

    const storageKey = StorageKeys.capture(runId, 'placeholder');

    const [row] = infra.db
      .insert(snapshots)
      .values({
        runId,
        url: TEST_URL,
        viewport: TEST_VIEWPORT,
        browser: 'chromium',
        storageKey,
      })
      .returning().all();

    expect(row).toBeDefined();
    expect(row.runId).toBe(runId);
    expect(row.url).toBe(TEST_URL);
    snapshotId = row.id;

    // Re-upload the image using the real snapshot id
    const realKey = StorageKeys.capture(runId, snapshotId);
    await infra.storage.upload(realKey, TINY_PNG, 'image/png');

    // Update the storageKey in the database to reflect the real key
    infra.db
      .update(snapshots)
      .set({ storageKey: realKey })
      .where(eq(snapshots.id, snapshotId))
      .run();
  });

  // -----------------------------------------------------------------------
  // 5. Create a baseline from the snapshot
  // -----------------------------------------------------------------------
  it('creates a baseline from the snapshot', async () => {

    const baselineKey = StorageKeys.baseline(projectId, snapshotId);

    // Copy the capture image as the baseline
    await infra.storage.upload(baselineKey, TINY_PNG, 'image/png');

    const [row] = infra.db
      .insert(baselines)
      .values({
        projectId,
        url: TEST_URL,
        viewport: TEST_VIEWPORT,
        browser: 'chromium',
        storageKey: baselineKey,
        snapshotId,
        approvedBy: 'e2e-test',
      })
      .returning().all();

    expect(row).toBeDefined();
    expect(row.projectId).toBe(projectId);
    expect(row.snapshotId).toBe(snapshotId);
    baselineId = row.id;
  });

  // -----------------------------------------------------------------------
  // 6. Create a diff report comparing snapshot to baseline
  // -----------------------------------------------------------------------
  it('creates a diff report comparing snapshot to baseline', async () => {

    const baselineKey = StorageKeys.baseline(projectId, snapshotId);
    const diffKey = StorageKeys.diff(runId, snapshotId);

    // Upload a diff image (reuse the same tiny PNG for simplicity)
    await infra.storage.upload(diffKey, TINY_PNG, 'image/png');

    const [row] = infra.db
      .insert(diffReports)
      .values({
        snapshotId,
        baselineStorageKey: baselineKey,
        diffStorageKey: diffKey,
        pixelDiffPercent: 0,
        ssimScore: 10000, // perfect match
        passed: 'true',
      })
      .returning().all();

    expect(row).toBeDefined();
    expect(row.snapshotId).toBe(snapshotId);
    expect(row.pixelDiffPercent).toBe(0);
    expect(row.passed).toBe('true');
    diffReportId = row.id;
  });

  // -----------------------------------------------------------------------
  // 7. Query the full chain: project -> run -> snapshot -> diff
  // -----------------------------------------------------------------------
  it('can query the full chain: project -> run -> snapshot -> diff', async () => {

    // Verify project
    const [project] = infra.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId)).all();
    expect(project.name).toBe(PROJECT_NAME);

    // Verify capture run belongs to project
    const [run] = infra.db
      .select()
      .from(captureRuns)
      .where(eq(captureRuns.id, runId)).all();
    expect(run.projectId).toBe(projectId);

    // Verify snapshot belongs to run
    const [snap] = infra.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.id, snapshotId)).all();
    expect(snap.runId).toBe(runId);

    // Verify diff report belongs to snapshot
    const [diff] = infra.db
      .select()
      .from(diffReports)
      .where(eq(diffReports.id, diffReportId)).all();
    expect(diff.snapshotId).toBe(snapshotId);

    // Verify baseline belongs to project and references snapshot
    const [baseline] = infra.db
      .select()
      .from(baselines)
      .where(eq(baselines.id, baselineId)).all();
    expect(baseline.projectId).toBe(projectId);
    expect(baseline.snapshotId).toBe(snapshotId);

    // Verify all storage objects are retrievable
    const captureKey = StorageKeys.capture(runId, snapshotId);
    const baselineKey = StorageKeys.baseline(projectId, snapshotId);
    const diffKey = StorageKeys.diff(runId, snapshotId);

    const [captureBuf, baselineBuf, diffBuf] = await Promise.all([
      infra.storage.download(captureKey),
      infra.storage.download(baselineKey),
      infra.storage.download(diffKey),
    ]);

    expect(captureBuf.length).toBeGreaterThan(0);
    expect(baselineBuf.length).toBeGreaterThan(0);
    expect(diffBuf.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // 8. Mark the capture run as completed
  // -----------------------------------------------------------------------
  it('marks the capture run as completed', async () => {

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
