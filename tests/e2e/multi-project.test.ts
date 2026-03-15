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
} = sqliteSchema;

// Minimal valid 1x1 transparent PNG (67 bytes)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
    'Nl7BcQAAAABJRU5ErkJggg==',
  'base64',
);

const PROJECT_NAME_A = 'e2e-multi-project-a';
const PROJECT_NAME_B = 'e2e-multi-project-b';
const TEST_URL = 'https://example.com/multi';
const TEST_VIEWPORT = '1280x720';

describe('Multi-Project Data Isolation (E2E)', () => {
  let infra: E2eInfra;
  let projectIdA: string;
  let projectIdB: string;
  let runIdA: string;
  let runIdB: string;
  let snapshotIdA: string;
  let snapshotIdB: string;

  beforeAll(async () => {
    infra = await setupE2eInfra();
  });

  afterAll(async () => {
    await teardownE2eInfra(infra.tempDir);
  });

  // -----------------------------------------------------------------------
  // 1. Create two projects
  // -----------------------------------------------------------------------
  it('creates two projects', async () => {
    const [projA] = infra.db
      .insert(projects)
      .values({ name: PROJECT_NAME_A })
      .returning().all();
    expect(projA).toBeDefined();
    projectIdA = projA.id;

    const [projB] = infra.db
      .insert(projects)
      .values({ name: PROJECT_NAME_B })
      .returning().all();
    expect(projB).toBeDefined();
    projectIdB = projB.id;

    expect(projectIdA).not.toBe(projectIdB);
  });

  // -----------------------------------------------------------------------
  // 2. Create runs and snapshots in each project
  // -----------------------------------------------------------------------
  it('creates runs and snapshots in each project', async () => {
    // Project A — run + snapshot
    const [runA] = infra.db
      .insert(captureRuns)
      .values({
        projectId: projectIdA,
        status: 'completed',
        source: 'manual',
        commitSha: 'aaa111',
        branchName: 'main',
      })
      .returning().all();
    runIdA = runA.id;

    const storageKeyA = StorageKeys.capture(runIdA, 'placeholder-a');
    const [snapA] = infra.db
      .insert(snapshots)
      .values({
        runId: runIdA,
        url: TEST_URL,
        viewport: TEST_VIEWPORT,
        browser: 'chromium',
        storageKey: storageKeyA,
      })
      .returning().all();
    snapshotIdA = snapA.id;

    const realKeyA = StorageKeys.capture(runIdA, snapshotIdA);
    await infra.storage.upload(realKeyA, TINY_PNG, 'image/png');
    infra.db
      .update(snapshots)
      .set({ storageKey: realKeyA })
      .where(eq(snapshots.id, snapshotIdA))
      .run();

    // Project B — run + snapshot
    const [runB] = infra.db
      .insert(captureRuns)
      .values({
        projectId: projectIdB,
        status: 'completed',
        source: 'manual',
        commitSha: 'bbb222',
        branchName: 'main',
      })
      .returning().all();
    runIdB = runB.id;

    const storageKeyB = StorageKeys.capture(runIdB, 'placeholder-b');
    const [snapB] = infra.db
      .insert(snapshots)
      .values({
        runId: runIdB,
        url: TEST_URL,
        viewport: TEST_VIEWPORT,
        browser: 'chromium',
        storageKey: storageKeyB,
      })
      .returning().all();
    snapshotIdB = snapB.id;

    const realKeyB = StorageKeys.capture(runIdB, snapshotIdB);
    await infra.storage.upload(realKeyB, TINY_PNG, 'image/png');
    infra.db
      .update(snapshots)
      .set({ storageKey: realKeyB })
      .where(eq(snapshots.id, snapshotIdB))
      .run();
  });

  // -----------------------------------------------------------------------
  // 3. Querying one project does not return the other's runs
  // -----------------------------------------------------------------------
  it('querying project A runs does not include project B runs', async () => {
    const runsA = infra.db
      .select()
      .from(captureRuns)
      .where(eq(captureRuns.projectId, projectIdA)).all();

    expect(runsA.length).toBe(1);
    expect(runsA[0]!.id).toBe(runIdA);

    // None of project A's runs should belong to project B
    for (const run of runsA) {
      expect(run.projectId).toBe(projectIdA);
      expect(run.projectId).not.toBe(projectIdB);
    }
  });

  it('querying project B runs does not include project A runs', async () => {
    const runsB = infra.db
      .select()
      .from(captureRuns)
      .where(eq(captureRuns.projectId, projectIdB)).all();

    expect(runsB.length).toBe(1);
    expect(runsB[0]!.id).toBe(runIdB);

    for (const run of runsB) {
      expect(run.projectId).toBe(projectIdB);
      expect(run.projectId).not.toBe(projectIdA);
    }
  });

  // -----------------------------------------------------------------------
  // 4. Querying snapshots is isolated by run -> project
  // -----------------------------------------------------------------------
  it('snapshots are isolated by project through runs', async () => {
    const snapsA = infra.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.runId, runIdA)).all();

    expect(snapsA.length).toBe(1);
    expect(snapsA[0]!.id).toBe(snapshotIdA);

    const snapsB = infra.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.runId, runIdB)).all();

    expect(snapsB.length).toBe(1);
    expect(snapsB[0]!.id).toBe(snapshotIdB);
  });

  // -----------------------------------------------------------------------
  // 5. Cleanup of one project does not affect the other
  // -----------------------------------------------------------------------
  it('cleaning up project A does not remove project B data', async () => {
    cleanupTestData(infra.db, PROJECT_NAME_A);

    // Project A should be gone
    const remainingA = infra.db
      .select()
      .from(projects)
      .where(eq(projects.name, PROJECT_NAME_A)).all();
    expect(remainingA.length).toBe(0);

    // Project B should still exist
    const remainingB = infra.db
      .select()
      .from(projects)
      .where(eq(projects.name, PROJECT_NAME_B)).all();
    expect(remainingB.length).toBe(1);
    expect(remainingB[0]!.id).toBe(projectIdB);

    // Project B's runs should still exist
    const runsB = infra.db
      .select()
      .from(captureRuns)
      .where(eq(captureRuns.projectId, projectIdB)).all();
    expect(runsB.length).toBe(1);

    // Project B's snapshots should still exist
    const snapsB = infra.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.runId, runIdB)).all();
    expect(snapsB.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 6. Project names can be duplicated (no workspace constraint in local mode)
  // -----------------------------------------------------------------------
  it('allows duplicate project names in local mode', async () => {
    const [projA2] = infra.db
      .insert(projects)
      .values({ name: 'e2e-shared-name' })
      .returning().all();
    expect(projA2).toBeDefined();

    const [projB2] = infra.db
      .insert(projects)
      .values({ name: 'e2e-shared-name' })
      .returning().all();
    expect(projB2).toBeDefined();

    expect(projA2.id).not.toBe(projB2.id);

    // Clean up
    infra.db.delete(projects).where(eq(projects.id, projA2.id)).run();
    infra.db.delete(projects).where(eq(projects.id, projB2.id)).run();
  });
});
