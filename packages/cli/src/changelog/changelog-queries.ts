/**
 * Changelog query functions — raw SQLite queries for route and commit history.
 *
 * These accept a minimal db interface compatible with better-sqlite3:
 *   { prepare: (sql) => { all: (...args) => any[] } }
 */

export interface ChangelogEntry {
  url: string;
  viewport: string;
  browser: string;
  commitSha: string | null;
  branchName: string | null;
  pixelDiffPercent: number;
  ssimScore: number | null;
  passed: string;
  diffStorageKey: string | null;
  baselineStorageKey: string | null;
  snapshotStorageKey: string;
  createdAt: number;
  approvalAction: string | null;
  approvalBy: string | null;
  approvalReason: string | null;
}

export interface ChangelogDb {
  prepare(sql: string): { all(...args: unknown[]): unknown[] };
}

const BASE_SELECT = `
  SELECT
    s.url            AS url,
    s.viewport       AS viewport,
    s.browser        AS browser,
    cr.commit_sha    AS commitSha,
    cr.branch_name   AS branchName,
    dr.pixel_diff_percent AS pixelDiffPercent,
    dr.ssim_score    AS ssimScore,
    dr.passed        AS passed,
    dr.diff_s3_key   AS diffStorageKey,
    dr.baseline_s3_key AS baselineStorageKey,
    s.s3_key         AS snapshotStorageKey,
    dr.created_at    AS createdAt,
    ad.action        AS approvalAction,
    ad.user_email    AS approvalBy,
    ad.reason        AS approvalReason
  FROM diff_reports dr
  JOIN snapshots s      ON s.id = dr.snapshot_id
  JOIN capture_runs cr  ON cr.id = s.run_id
  LEFT JOIN approval_decisions ad ON ad.diff_report_id = dr.id
`;

/**
 * Query changelog entries for a specific route (URL), optionally filtered by viewport.
 * Returns most recent first. Default limit 50.
 */
export function queryChangelogByRoute(
  db: ChangelogDb,
  projectId: string,
  url: string,
  viewport?: string,
  limit = 50,
): ChangelogEntry[] {
  if (viewport) {
    const sql = `${BASE_SELECT}
      WHERE cr.project_id = ? AND s.url = ? AND s.viewport = ?
      ORDER BY dr.created_at DESC
      LIMIT ?`;
    return db.prepare(sql).all(projectId, url, viewport, limit) as ChangelogEntry[];
  }

  const sql = `${BASE_SELECT}
    WHERE cr.project_id = ? AND s.url = ?
    ORDER BY dr.created_at DESC
    LIMIT ?`;
  return db.prepare(sql).all(projectId, url, limit) as ChangelogEntry[];
}

/**
 * Query changelog entries for a specific commit SHA.
 * Returns entries ordered by url, then viewport.
 */
export function queryChangelogByCommit(
  db: ChangelogDb,
  projectId: string,
  commitSha: string,
): ChangelogEntry[] {
  const sql = `${BASE_SELECT}
    WHERE cr.project_id = ? AND cr.commit_sha = ?
    ORDER BY s.url, s.viewport`;
  return db.prepare(sql).all(projectId, commitSha) as ChangelogEntry[];
}
