import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  setupE2eInfra,
  teardownE2eInfra,
  type E2eInfra,
} from './setup.js';
import { sqliteSchema } from '@sentinel-vrt/db';

const {
  projects,
  captureRuns,
  snapshots,
  diffReports,
  approvalDecisions,
} = sqliteSchema;

const PROJECT_NAME = 'e2e-error-handling';
const FAKE_UUID = '00000000-0000-0000-0000-000000000099';

describe('Error Handling & Constraints (E2E)', () => {
  let infra: E2eInfra;
  let projectId: string;
  let runId: string;
  let snapshotId: string;
  let diffReportId: string;

  beforeAll(async () => {
    infra = await setupE2eInfra();

    // Create supporting records for constraint tests
    const [proj] = infra.db
      .insert(projects)
      .values({ name: PROJECT_NAME })
      .returning().all();
    projectId = proj.id;

    const [run] = infra.db
      .insert(captureRuns)
      .values({
        projectId,
        status: 'completed',
        source: 'manual',
        commitSha: 'err111',
        branchName: 'main',
      })
      .returning().all();
    runId = run.id;

    const [snap] = infra.db
      .insert(snapshots)
      .values({
        runId,
        url: 'https://example.com/error-test',
        viewport: '1280x720',
        browser: 'chromium',
        storageKey: 'test/error-handling/placeholder.png',
      })
      .returning().all();
    snapshotId = snap.id;

    const [diff] = infra.db
      .insert(diffReports)
      .values({
        snapshotId,
        baselineStorageKey: 'test/error-handling/baseline.png',
        diffStorageKey: 'test/error-handling/diff.png',
        pixelDiffPercent: 0,
        ssimScore: 10000,
        passed: 'true',
      })
      .returning().all();
    diffReportId = diff.id;
  });

  afterAll(async () => {
    await teardownE2eInfra(infra.tempDir);
  });

  // -----------------------------------------------------------------------
  // 1. FK constraint: capture_runs.project_id must reference a valid project
  // -----------------------------------------------------------------------
  it('rejects a capture run with non-existent projectId', async () => {
    expect(() =>
      infra.db
        .insert(captureRuns)
        .values({
          projectId: FAKE_UUID,
          status: 'pending',
          source: 'manual',
        })
        .returning().all(),
    ).toThrow();
  });

  // -----------------------------------------------------------------------
  // 2. FK constraint: snapshots.run_id must reference a valid capture run
  // -----------------------------------------------------------------------
  it('rejects a snapshot with non-existent runId', async () => {
    expect(() =>
      infra.db
        .insert(snapshots)
        .values({
          runId: FAKE_UUID,
          url: 'https://example.com',
          viewport: '1280x720',
          browser: 'chromium',
          storageKey: 'test/nonexistent/snap.png',
        })
        .returning().all(),
    ).toThrow();
  });

  // -----------------------------------------------------------------------
  // 3. FK constraint: diff_reports.snapshot_id must reference a valid snapshot
  // -----------------------------------------------------------------------
  it('rejects a diff report with non-existent snapshotId', async () => {
    expect(() =>
      infra.db
        .insert(diffReports)
        .values({
          snapshotId: FAKE_UUID,
          baselineStorageKey: 'test/nonexistent/baseline.png',
          diffStorageKey: 'test/nonexistent/diff.png',
          pixelDiffPercent: 0,
          ssimScore: 10000,
          passed: 'true',
        })
        .returning().all(),
    ).toThrow();
  });

  // -----------------------------------------------------------------------
  // 4. FK constraint: approval_decisions.diff_report_id must be valid
  // -----------------------------------------------------------------------
  it('rejects an approval decision with non-existent diffReportId', async () => {
    expect(() =>
      infra.db
        .insert(approvalDecisions)
        .values({
          diffReportId: FAKE_UUID,
          action: 'approved',
          userId: 'user-e2e',
          userEmail: 'test@example.com',
        })
        .returning().all(),
    ).toThrow();
  });

  // -----------------------------------------------------------------------
  // 5. Multiple approval decisions for same diff are allowed
  //    (no unique constraint on diff_report_id in approval_decisions)
  // -----------------------------------------------------------------------
  it('allows multiple approval decisions for the same diff report', async () => {
    const [first] = infra.db
      .insert(approvalDecisions)
      .values({
        diffReportId,
        action: 'rejected',
        userId: 'user-reviewer-1',
        userEmail: 'reviewer1@example.com',
        reason: 'Needs fixes',
      })
      .returning().all();
    expect(first).toBeDefined();

    const [second] = infra.db
      .insert(approvalDecisions)
      .values({
        diffReportId,
        action: 'approved',
        userId: 'user-reviewer-2',
        userEmail: 'reviewer2@example.com',
        reason: 'Looks good now',
      })
      .returning().all();
    expect(second).toBeDefined();

    // Both decisions should exist
    const decisions = infra.db
      .select()
      .from(approvalDecisions)
      .where(eq(approvalDecisions.diffReportId, diffReportId)).all();

    expect(decisions.length).toBe(2);
    expect(decisions.map((d) => d.action).sort()).toEqual(['approved', 'rejected']);
  });

  // -----------------------------------------------------------------------
  // 6. Storage: downloading a non-existent key throws
  // -----------------------------------------------------------------------
  it('throws when downloading a non-existent storage key', async () => {
    await expect(
      infra.storage.download('nonexistent/key/that/does/not/exist.png'),
    ).rejects.toThrow();
  });

  // -----------------------------------------------------------------------
  // 7. NOT NULL constraints: required fields cannot be omitted
  // -----------------------------------------------------------------------
  it('rejects a snapshot without a url', async () => {
    expect(() =>
      infra.db
        .insert(snapshots)
        .values({
          runId,
          viewport: '1280x720',
          browser: 'chromium',
          storageKey: 'test/missing-url.png',
        } as any)
        .returning().all(),
    ).toThrow();
  });
});
