export const id = 255;
export const ids = [255];
export const modules = {

/***/ 87255:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  getThresholdRecommendations: () => (/* binding */ getThresholdRecommendations),
  recordDiffHistory: () => (/* binding */ recordDiffHistory)
});

// EXTERNAL MODULE: external "node:crypto"
var external_node_crypto_ = __webpack_require__(77598);
;// CONCATENATED MODULE: ../../packages/capture/dist/thresholds/adaptive-threshold-engine.js
const hasEnoughHistory = (history, minRuns) => history.length >= minRuns;
const percentile = (sorted, p) => {
    const idx = Math.min(Math.max(Math.ceil(sorted.length * p) - 1, 0), sorted.length - 1);
    return sorted[idx];
};
const computeAdaptiveThresholds = (history, p = 0.95) => {
    const pixelValues = history.map((h) => h.pixelDiffPercent).sort((a, b) => a - b);
    const p95Pixel = percentile(pixelValues, p);
    const pixelDiffPercent = Math.max(p95Pixel * 1.2, 0.01);
    const ssimValues = history
        .map((h) => h.ssimScore)
        .filter((s) => s !== null)
        .sort((a, b) => a - b);
    let ssimMin;
    if (ssimValues.length === 0) {
        ssimMin = 0.95;
    }
    else {
        const p5Ssim = percentile(ssimValues, 1 - p);
        ssimMin = Math.min(p5Ssim * 0.998, 1 - 0.001);
    }
    return { pixelDiffPercent, ssimMin };
};
//# sourceMappingURL=adaptive-threshold-engine.js.map
;// CONCATENATED MODULE: ../../packages/cli/dist/threshold-reporter.js


/**
 * Record diff results into the route_threshold_history table for adaptive
 * threshold computation.  Converts from human-readable scales to the
 * basis-point / 0-10000 storage format used in SQLite.
 */
function recordDiffHistory(db, projectId, runId, diffs) {
    const client = db.$client;
    const stmt = client.prepare(`INSERT INTO route_threshold_history
       (id, project_id, url, viewport, browser, pixel_diff_percent, ssim_score, run_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const now = Date.now();
    for (const diff of diffs) {
        stmt.run((0,external_node_crypto_.randomUUID)(), projectId, diff.url, diff.viewport, 'chromium', // default browser; viewport-level grouping is the key axis
        Math.round(diff.pixelDiffPercent * 100), // basis points
        diff.ssimScore != null ? Math.round(diff.ssimScore * 10000) : null, runId, now);
    }
}
/**
 * Query stored threshold history and return adaptive recommendations for
 * route+viewport groups that have enough data points.
 */
function getThresholdRecommendations(db, projectId, minRuns) {
    const client = db.$client;
    const rows = client
        .prepare(`SELECT url, viewport, pixel_diff_percent, ssim_score
       FROM route_threshold_history
       WHERE project_id = ?
       ORDER BY url, viewport`)
        .all(projectId);
    // Group by url+viewport
    const groups = new Map();
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
    const recommendations = [];
    for (const group of Array.from(groups.values())) {
        if (!hasEnoughHistory(group.entries, minRuns))
            continue;
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
//# sourceMappingURL=threshold-reporter.js.map

/***/ })

};

//# sourceMappingURL=255.index.js.map