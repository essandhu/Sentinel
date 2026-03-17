import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteDb } from '@sentinel-vrt/db';
import { queryChangelogByRoute, queryChangelogByCommit } from './changelog-queries.js';

let dbPath: string;
let rawDb: any;

function seedData(db: any) {
  const now = Date.now();
  const oneHourAgo = now - 3600_000;
  const twoHoursAgo = now - 7200_000;

  db.exec(`
    INSERT INTO projects (id, name, created_at)
    VALUES ('proj-1', 'Test Project', ${now});

    INSERT INTO capture_runs (id, project_id, commit_sha, branch_name, status, created_at)
    VALUES
      ('run-1', 'proj-1', 'abc123', 'main', 'completed', ${twoHoursAgo}),
      ('run-2', 'proj-1', 'def456', 'feature/x', 'completed', ${oneHourAgo}),
      ('run-3', 'proj-1', 'abc123', 'main', 'completed', ${now});

    INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, captured_at)
    VALUES
      ('snap-1', 'run-1', 'https://example.com/', '1920x1080', 'chromium', 'snapshots/snap-1.png', ${twoHoursAgo}),
      ('snap-2', 'run-2', 'https://example.com/', '1920x1080', 'chromium', 'snapshots/snap-2.png', ${oneHourAgo}),
      ('snap-3', 'run-2', 'https://example.com/', '375x812', 'chromium', 'snapshots/snap-3.png', ${oneHourAgo}),
      ('snap-4', 'run-3', 'https://example.com/about', '1920x1080', 'chromium', 'snapshots/snap-4.png', ${now});

    INSERT INTO diff_reports (id, snapshot_id, baseline_s3_key, diff_s3_key, pixel_diff_percent, ssim_score, passed, created_at)
    VALUES
      ('diff-1', 'snap-1', 'baselines/b1.png', 'diffs/d1.png', 250, 9800, 'passed', ${twoHoursAgo}),
      ('diff-2', 'snap-2', 'baselines/b2.png', 'diffs/d2.png', 500, 9500, 'failed', ${oneHourAgo}),
      ('diff-3', 'snap-3', 'baselines/b3.png', 'diffs/d3.png', 100, 9900, 'passed', ${oneHourAgo}),
      ('diff-4', 'snap-4', 'baselines/b4.png', 'diffs/d4.png', 0, 10000, 'passed', ${now});

    INSERT INTO approval_decisions (id, diff_report_id, action, user_id, user_email, reason, created_at)
    VALUES
      ('appr-1', 'diff-2', 'approved', 'user-1', 'alice@example.com', 'Looks good', ${oneHourAgo});
  `);

  return { now, oneHourAgo, twoHoursAgo };
}

describe('changelog-queries', () => {
  beforeEach(() => {
    dbPath = join(tmpdir(), `sentinel-changelog-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    const drizzleDb = createSqliteDb(dbPath);
    rawDb = (drizzleDb as any).$client;
    seedData(rawDb);
  });

  afterEach(() => {
    try { unlinkSync(dbPath); } catch {}
    try { unlinkSync(dbPath + '-wal'); } catch {}
    try { unlinkSync(dbPath + '-shm'); } catch {}
  });

  describe('queryChangelogByRoute', () => {
    it('returns timeline for a specific route, most recent first', () => {
      const results = queryChangelogByRoute(rawDb, 'proj-1', 'https://example.com/');

      expect(results.length).toBe(3);
      expect(results[0].createdAt).toBeGreaterThanOrEqual(results[1].createdAt);
      expect(results[1].createdAt).toBeGreaterThanOrEqual(results[2].createdAt);
      for (const entry of results) {
        expect(entry.url).toBe('https://example.com/');
      }
    });

    it('includes approval info via LEFT JOIN', () => {
      const results = queryChangelogByRoute(rawDb, 'proj-1', 'https://example.com/');

      const approved = results.find(r => r.snapshotStorageKey === 'snapshots/snap-2.png');
      expect(approved).toBeDefined();
      expect(approved!.approvalAction).toBe('approved');
      expect(approved!.approvalBy).toBe('alice@example.com');
      expect(approved!.approvalReason).toBe('Looks good');

      const noApproval = results.find(r => r.snapshotStorageKey === 'snapshots/snap-1.png');
      expect(noApproval).toBeDefined();
      expect(noApproval!.approvalAction).toBeNull();
      expect(noApproval!.approvalBy).toBeNull();
    });

    it('respects limit param', () => {
      const results = queryChangelogByRoute(rawDb, 'proj-1', 'https://example.com/', undefined, 1);

      expect(results.length).toBe(1);
    });

    it('filters by viewport when provided', () => {
      const results = queryChangelogByRoute(rawDb, 'proj-1', 'https://example.com/', '375x812');

      expect(results.length).toBe(1);
      expect(results[0].viewport).toBe('375x812');
    });
  });

  describe('queryChangelogByCommit', () => {
    it('returns all diffs for a commit ordered by url then viewport', () => {
      const results = queryChangelogByCommit(rawDb, 'proj-1', 'def456');

      expect(results.length).toBe(2);
      expect(results[0].commitSha).toBe('def456');
      expect(results[1].commitSha).toBe('def456');
      expect(results[0].viewport <= results[1].viewport).toBe(true);
    });

    it('returns empty array for unknown commit', () => {
      const results = queryChangelogByCommit(rawDb, 'proj-1', 'nonexistent');

      expect(results).toEqual([]);
    });
  });
});
