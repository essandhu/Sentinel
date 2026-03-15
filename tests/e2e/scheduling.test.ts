import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  setupE2eInfra,
  teardownE2eInfra,
  type E2eInfra,
} from './setup.js';
import { sqliteSchema } from '@sentinel/db';

const {
  projects,
  captureRuns,
  testPlanRuns,
} = sqliteSchema;

const PROJECT_NAME = 'e2e-scheduling';

// Note: captureSchedules and environments are enterprise-only features
// removed from the local-first SQLite schema. This test covers the
// remaining scheduling-related functionality (test plan runs).

describe('Test Plan Runs (E2E)', () => {
  let infra: E2eInfra;
  let projectId: string;
  let testPlanRunId1: string;
  let testPlanRunId2: string;

  beforeAll(async () => {
    infra = await setupE2eInfra();
  });

  afterAll(async () => {
    await teardownE2eInfra(infra.tempDir);
  });

  // -----------------------------------------------------------------------
  // 1. Create a project
  // -----------------------------------------------------------------------
  it('creates a project', async () => {

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
  // 2. Creates a test plan run
  // -----------------------------------------------------------------------
  it('creates a test plan run', async () => {

    const [row] = infra.db
      .insert(testPlanRuns)
      .values({
        projectId,
        planName: 'smoke-test',
        status: 'running',
      })
      .returning().all();

    expect(row).toBeDefined();
    expect(row.projectId).toBe(projectId);
    expect(row.planName).toBe('smoke-test');
    expect(row.status).toBe('running');
    testPlanRunId1 = row.id;
  });

  // -----------------------------------------------------------------------
  // 3. Marks test plan run as completed
  // -----------------------------------------------------------------------
  it('marks test plan run as completed', async () => {

    const completedAt = new Date();

    infra.db
      .update(testPlanRuns)
      .set({ status: 'completed', completedAt })
      .where(eq(testPlanRuns.id, testPlanRunId1))
      .run();

    const [updated] = infra.db
      .select()
      .from(testPlanRuns)
      .where(eq(testPlanRuns.id, testPlanRunId1)).all();

    expect(updated.status).toBe('completed');
    expect(updated.completedAt).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 4. Marks test plan run as failed at step
  // -----------------------------------------------------------------------
  it('marks test plan run as failed at step', async () => {

    // Create a second test plan run
    const [row] = infra.db
      .insert(testPlanRuns)
      .values({
        projectId,
        planName: 'full-regression',
        status: 'running',
      })
      .returning().all();

    testPlanRunId2 = row.id;

    // Mark it as failed at a specific step
    infra.db
      .update(testPlanRuns)
      .set({ status: 'failed', failedAtStep: 'visual-regression' })
      .where(eq(testPlanRuns.id, testPlanRunId2))
      .run();

    const [updated] = infra.db
      .select()
      .from(testPlanRuns)
      .where(eq(testPlanRuns.id, testPlanRunId2)).all();

    expect(updated.status).toBe('failed');
    expect(updated.failedAtStep).toBe('visual-regression');
  });

  // -----------------------------------------------------------------------
  // 5. Links capture run to test plan run
  // -----------------------------------------------------------------------
  it('links capture run to test plan run', async () => {

    const [run] = infra.db
      .insert(captureRuns)
      .values({
        projectId,
        status: 'completed',
        source: 'manual',
        testPlanRunId: testPlanRunId1,
      })
      .returning().all();

    expect(run).toBeDefined();
    expect(run.testPlanRunId).toBe(testPlanRunId1);

    // Verify the link
    const [fetched] = infra.db
      .select()
      .from(captureRuns)
      .where(eq(captureRuns.id, run.id)).all();

    expect(fetched.testPlanRunId).toBe(testPlanRunId1);
    expect(fetched.projectId).toBe(projectId);
  });
});
