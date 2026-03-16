import { randomUUID } from 'node:crypto';
import {
  computeAdaptiveThresholds,
  hasEnoughHistory,
  type ThresholdHistoryEntry,
} from '@sentinel/capture';

interface DiffForHistory {
  url: string;
  viewport: string;
  pixelDiffPercent: number; // 0-100 scale (e.g., 0.05 = 0.05%)
  ssimScore: number | null; // 0-1 scale
  passed: boolean;
}

export interface ThresholdRecommendation {
  url: string;
  viewport: string;
  recommended: { pixelDiffPercent: number; ssimMin: number };
  dataPoints: number;
}

/**
 * Record diff results into the route_threshold_history table for adaptive
 * threshold computation.  Converts from human-readable scales to the
 * basis-point / 0-10000 storage format used in SQLite.
 */
export function recordDiffHistory(
  db: any,
  projectId: string,
  runId: string,
  diffs: DiffForHistory[],
): void {
  const client = db.$client;
  const stmt = client.prepare(
    `INSERT INTO route_threshold_history
       (id, project_id, url, viewport, browser, pixel_diff_percent, ssim_score, run_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const now = Date.now();

  for (const diff of diffs) {
    stmt.run(
      randomUUID(),
      projectId,
      diff.url,
      diff.viewport,
      'chromium', // default browser; viewport-level grouping is the key axis
      Math.round(diff.pixelDiffPercent * 100), // basis points
      diff.ssimScore != null ? Math.round(diff.ssimScore * 10000) : null,
      runId,
      now,
    );
  }
}

/**
 * Query stored threshold history and return adaptive recommendations for
 * route+viewport groups that have enough data points.
 */
export function getThresholdRecommendations(
  db: any,
  projectId: string,
  minRuns: number,
): ThresholdRecommendation[] {
  const client = db.$client;

  const rows = client
    .prepare(
      `SELECT url, viewport, pixel_diff_percent, ssim_score
       FROM route_threshold_history
       WHERE project_id = ?
       ORDER BY url, viewport`,
    )
    .all(projectId) as Array<{
    url: string;
    viewport: string;
    pixel_diff_percent: number;
    ssim_score: number | null;
  }>;

  // Group by url+viewport
  const groups = new Map<string, { url: string; viewport: string; entries: ThresholdHistoryEntry[] }>();

  for (const row of rows) {
    const key = `${row.url}|${row.viewport}`;
    let group = groups.get(key);
    if (!group) {
      group = { url: row.url, viewport: row.viewport, entries: [] };
      groups.set(key, group);
    }
    group.entries.push({
      pixelDiffPercent: row.pixel_diff_percent / 100, // basis points -> percent
      ssimScore: row.ssim_score != null ? row.ssim_score / 10000 : null,
    });
  }

  const recommendations: ThresholdRecommendation[] = [];

  for (const group of Array.from(groups.values())) {
    if (!hasEnoughHistory(group.entries, minRuns)) continue;

    const result = computeAdaptiveThresholds(group.entries);
    recommendations.push({
      url: group.url,
      viewport: group.viewport,
      recommended: result,
      dataPoints: group.entries.length,
    });
  }

  return recommendations;
}
