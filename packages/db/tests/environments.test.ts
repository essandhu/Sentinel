import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { createSqliteDb, type SqliteDb, sqliteSchema } from '../src/index.js';

const {
  projects,
  captureRuns,
  snapshots,
  diffReports,
  environmentDiffs,
} = sqliteSchema;

// Note: The `environments` and `approvalChainSteps`/`approvalChainProgress`
// tables are enterprise-only and removed from the SQLite schema.
// This test covers environment diffs which are still present.

let db: SqliteDb;
let tempDir: string;

let projectId: string;
let captureRunId: string;
let captureRun2Id: string;
let snapshot1Id: string;
let snapshot2Id: string;

describe('Environment diffs (SQLite)', () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-db-envdiffs-'));
    db = createSqliteDb(join(tempDir, 'test.db'));

    // Create prerequisite rows
    const [project] = db
      .insert(projects)
      .values({ name: 'env-test-project' })
      .returning().all();
    projectId = project.id;

    const [run] = db
      .insert(captureRuns)
      .values({ projectId, status: 'completed' })
      .returning().all();
    captureRunId = run.id;

    const [run2] = db
      .insert(captureRuns)
      .values({ projectId, status: 'completed' })
      .returning().all();
    captureRun2Id = run2.id;

    const [snap1] = db
      .insert(snapshots)
      .values({ runId: captureRunId, url: 'https://staging.example.com/', viewport: '1280x720', s3Key: 'snap/staging-1.png' })
      .returning().all();
    snapshot1Id = snap1.id;

    const [snap2] = db
      .insert(snapshots)
      .values({ runId: captureRun2Id, url: 'https://prod.example.com/', viewport: '1280x720', s3Key: 'snap/prod-1.png' })
      .returning().all();
    snapshot2Id = snap2.id;
  });

  afterAll(async () => {
    try { await rm(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('can create and query environment diffs', () => {
    const [envDiff] = db
      .insert(environmentDiffs)
      .values({
        projectId,
        sourceEnv: 'staging',
        targetEnv: 'production',
        url: 'https://example.com/',
        viewport: '1280x720',
        browser: 'chromium',
        sourceSnapshotId: snapshot1Id,
        targetSnapshotId: snapshot2Id,
        diffS3Key: 'env-diff/staging-prod-1.png',
        pixelDiffPercent: 150,
        ssimScore: 9850,
        passed: 'passed',
      })
      .returning().all();

    expect(envDiff.sourceEnv).toBe('staging');
    expect(envDiff.targetEnv).toBe('production');
    expect(envDiff.pixelDiffPercent).toBe(150);
    expect(envDiff.ssimScore).toBe(9850);
    expect(envDiff.passed).toBe('passed');

    // Query by project
    const results = db
      .select()
      .from(environmentDiffs)
      .where(eq(environmentDiffs.projectId, projectId)).all();

    expect(results).toHaveLength(1);
    expect(results[0].sourceSnapshotId).toBe(snapshot1Id);
    expect(results[0].targetSnapshotId).toBe(snapshot2Id);
  });
});
