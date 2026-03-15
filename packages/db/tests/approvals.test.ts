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
  approvalDecisions,
} = sqliteSchema;

let db: SqliteDb;
let tempDir: string;

// IDs for prerequisite rows shared across tests
let projectId: string;
let runId: string;
let snapshotId: string;
let diffReportId: string;

describe('Approval workflow tables (SQLite)', () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-db-approvals-'));
    db = createSqliteDb(join(tempDir, 'test.db'));

    // Create prerequisite rows: project -> captureRun -> snapshot -> diffReport
    const [proj] = db
      .insert(projects)
      .values({ name: 'approval-test' })
      .returning().all();
    projectId = proj.id;

    const [run] = db
      .insert(captureRuns)
      .values({ projectId, status: 'completed' })
      .returning().all();
    runId = run.id;

    const [snap] = db
      .insert(snapshots)
      .values({
        runId,
        url: 'https://example.com',
        viewport: '1920x1080',
        browser: 'chromium',
        s3Key: 'test/approval-snap.png',
      })
      .returning().all();
    snapshotId = snap.id;

    const [dr] = db
      .insert(diffReports)
      .values({
        snapshotId,
        baselineS3Key: 'test/approval-baseline.png',
        diffS3Key: 'test/approval-diff.png',
        pixelDiffPercent: 500,
        passed: 'pending',
      })
      .returning().all();
    diffReportId = dr.id;
  });

  afterAll(async () => {
    try { await rm(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('creates an approval decision for a diff report', () => {
    const [row] = db
      .insert(approvalDecisions)
      .values({
        diffReportId,
        action: 'approved',
        userId: 'user-123',
        userEmail: 'reviewer@example.com',
        reason: 'Intentional redesign of hero section',
      })
      .returning().all();

    expect(row.id).toBeDefined();
    expect(row.diffReportId).toBe(diffReportId);
    expect(row.action).toBe('approved');
    expect(row.userId).toBe('user-123');
    expect(row.userEmail).toBe('reviewer@example.com');
    expect(row.reason).toBe('Intentional redesign of hero section');
    expect(row.createdAt).toBeDefined();
  });

  it('can query approval decisions for a diff report', () => {
    const decisions = db
      .select()
      .from(approvalDecisions)
      .where(eq(approvalDecisions.diffReportId, diffReportId)).all();

    expect(decisions.length).toBeGreaterThanOrEqual(1);
    expect(decisions[0].action).toBe('approved');
    expect(decisions[0].userId).toBe('user-123');
  });

  it('updates diff report passed status after approval', () => {
    db
      .update(diffReports)
      .set({ passed: 'approved' })
      .where(eq(diffReports.id, diffReportId))
      .run();

    const [updated] = db
      .select()
      .from(diffReports)
      .where(eq(diffReports.id, diffReportId)).all();

    expect(updated.passed).toBe('approved');
  });
});
