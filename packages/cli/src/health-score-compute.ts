import type { SqliteDb } from '@sentinel-vrt/db';

/**
 * Compute and store project + component health scores after a capture run.
 * Score formula: round((passed / total) * 100)
 */
export function computeAndStoreHealthScores(db: SqliteDb, projectId: string): void {
  const client = (db as any).$client;
  if (!client?.prepare) return; // skip when running with mock db

  const now = Date.now();

  const latestRun = client.prepare(`
    SELECT id FROM capture_runs
    WHERE project_id = ? AND status = 'completed'
    ORDER BY created_at DESC LIMIT 1
  `).get(projectId) as { id: string } | undefined;

  if (!latestRun) return;

  const stats = client.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN d.passed = 'true' OR d.passed = 'passed' THEN 1 ELSE 0 END) AS passed
    FROM diff_reports d
    INNER JOIN snapshots s ON s.id = d.snapshot_id
    WHERE s.run_id = ?
  `).get(latestRun.id) as { total: number; passed: number };

  if (stats.total === 0) return;

  const projectScore = Math.round((stats.passed / stats.total) * 100);

  client.prepare(`
    INSERT INTO health_scores (id, project_id, component_id, score, window_days, computed_at)
    VALUES (?, ?, NULL, ?, 30, ?)
  `).run(crypto.randomUUID(), projectId, projectScore, now);

  // Component-level scores
  const componentStats = client.prepare(`
    SELECT
      s.component_id AS componentId,
      COUNT(*) AS total,
      SUM(CASE WHEN d.passed = 'true' OR d.passed = 'passed' THEN 1 ELSE 0 END) AS passed
    FROM diff_reports d
    INNER JOIN snapshots s ON s.id = d.snapshot_id
    WHERE s.run_id = ? AND s.component_id IS NOT NULL
    GROUP BY s.component_id
  `).all(latestRun.id) as Array<{ componentId: string; total: number; passed: number }>;

  for (const comp of componentStats) {
    const compScore = Math.round((comp.passed / comp.total) * 100);
    client.prepare(`
      INSERT INTO health_scores (id, project_id, component_id, score, window_days, computed_at)
      VALUES (?, ?, ?, ?, 30, ?)
    `).run(crypto.randomUUID(), projectId, comp.componentId, compScore, now);
  }
}
