import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { queryChangelogByRoute, queryChangelogByCommit } from './changelog-queries.js';

function createTables(db: InstanceType<typeof Database>) {
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE capture_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      commit_sha TEXT,
      branch_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE snapshots (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES capture_runs(id),
      url TEXT NOT NULL,
      viewport TEXT NOT NULL,
      browser TEXT NOT NULL DEFAULT 'chromium',
      s3_key TEXT NOT NULL,
      captured_at INTEGER NOT NULL
    );
    CREATE TABLE diff_reports (
      id TEXT PRIMARY KEY,
      snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
      baseline_s3_key TEXT NOT NULL,
      diff_s3_key TEXT NOT NULL,
      pixel_diff_percent INTEGER,
      ssim_score INTEGER,
      passed TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE approval_decisions (
      id TEXT PRIMARY KEY,
      diff_report_id TEXT NOT NULL REFERENCES diff_reports(id),
      action TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      reason TEXT,
      created_at INTEGER NOT NULL
    );
  `);
}

function seedData(db: InstanceType<typeof Database>) {
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
  let db: InstanceType<typeof Database>;

  beforeEach(() => {
    db = new Database(':memory:');
    createTables(db);
    seedData(db);
  });

  describe('queryChangelogByRoute', () => {
    it('returns timeline for a specific route, most recent first', () => {
      const results = queryChangelogByRoute(db, 'proj-1', 'https://example.com/');

      expect(results.length).toBe(3);
      // Most recent first: snap-2 and snap-3 from run-2 (oneHourAgo), then snap-1 from run-1 (twoHoursAgo)
      // diff-2 and diff-3 are tied on created_at (oneHourAgo), diff-1 is oldest
      expect(results[0].createdAt).toBeGreaterThanOrEqual(results[1].createdAt);
      expect(results[1].createdAt).toBeGreaterThanOrEqual(results[2].createdAt);
      // All should be for the requested URL
      for (const entry of results) {
        expect(entry.url).toBe('https://example.com/');
      }
    });

    it('includes approval info via LEFT JOIN', () => {
      const results = queryChangelogByRoute(db, 'proj-1', 'https://example.com/');

      // diff-2 has an approval
      const approved = results.find(r => r.snapshotStorageKey === 'snapshots/snap-2.png');
      expect(approved).toBeDefined();
      expect(approved!.approvalAction).toBe('approved');
      expect(approved!.approvalBy).toBe('alice@example.com');
      expect(approved!.approvalReason).toBe('Looks good');

      // diff-1 has no approval
      const noApproval = results.find(r => r.snapshotStorageKey === 'snapshots/snap-1.png');
      expect(noApproval).toBeDefined();
      expect(noApproval!.approvalAction).toBeNull();
      expect(noApproval!.approvalBy).toBeNull();
    });

    it('respects limit param', () => {
      const results = queryChangelogByRoute(db, 'proj-1', 'https://example.com/', undefined, 1);

      expect(results.length).toBe(1);
    });

    it('filters by viewport when provided', () => {
      const results = queryChangelogByRoute(db, 'proj-1', 'https://example.com/', '375x812');

      expect(results.length).toBe(1);
      expect(results[0].viewport).toBe('375x812');
    });
  });

  describe('queryChangelogByCommit', () => {
    it('returns all diffs for a commit ordered by url then viewport', () => {
      const results = queryChangelogByCommit(db, 'proj-1', 'def456');

      expect(results.length).toBe(2);
      expect(results[0].commitSha).toBe('def456');
      expect(results[1].commitSha).toBe('def456');
      // Ordered by url, viewport — both same url, so by viewport
      expect(results[0].viewport <= results[1].viewport).toBe(true);
    });

    it('returns empty array for unknown commit', () => {
      const results = queryChangelogByCommit(db, 'proj-1', 'nonexistent');

      expect(results).toEqual([]);
    });
  });
});
