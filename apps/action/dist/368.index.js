export const id = 368;
export const ids = [368];
export const modules = {

/***/ 18368:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   generateChangelogHtml: () => (/* binding */ generateChangelogHtml)
/* harmony export */ });
/* unused harmony exports groupByRoute, groupByCommit */
const escapeHtml = (str) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
const groupByRoute = (entries) => {
    const groups = {};
    for (const entry of entries) {
        const key = `${entry.url}|${entry.viewport}`;
        if (!groups[key])
            groups[key] = [];
        groups[key].push(entry);
    }
    return groups;
};
const groupByCommit = (entries) => {
    const groups = {};
    for (const entry of entries) {
        const key = entry.commitSha ?? 'unknown';
        if (!groups[key])
            groups[key] = [];
        groups[key].push(entry);
    }
    return groups;
};
const formatDiffPercent = (basisPoints) => (basisPoints / 100).toFixed(2);
const formatSsim = (raw) => raw === null ? 'N/A' : (raw / 10000).toFixed(4);
const statusBadge = (entry) => {
    if (entry.approvalAction === 'approved') {
        return '<span class="badge approved">approved</span>';
    }
    return entry.passed === 'true'
        ? '<span class="badge pass">pass</span>'
        : '<span class="badge fail">fail</span>';
};
const renderRow = (entry, showColumn) => {
    const firstCol = showColumn === 'commit'
        ? `<td>${escapeHtml(entry.commitSha ?? 'unknown')}</td>`
        : `<td>${escapeHtml(entry.url)} @ ${escapeHtml(entry.viewport)}</td>`;
    const approval = entry.approvalAction === 'approved'
        ? `<br><small>by ${escapeHtml(entry.approvalBy ?? '')}${entry.approvalReason ? `: ${escapeHtml(entry.approvalReason)}` : ''}</small>`
        : '';
    return `<tr>
    ${firstCol}
    <td>${escapeHtml(entry.browser)}</td>
    <td>${formatDiffPercent(entry.pixelDiffPercent)}%</td>
    <td>${formatSsim(entry.ssimScore)}</td>
    <td>${statusBadge(entry)}${approval}</td>
  </tr>`;
};
const CSS = `
  body { font-family: system-ui, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; color: #1a1a1a; }
  h1 { border-bottom: 2px solid #e0e0e0; padding-bottom: 8px; }
  h3 { margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
  th { background: #f5f5f5; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600; }
  .badge.pass { background: #d4edda; color: #155724; }
  .badge.fail { background: #f8d7da; color: #721c24; }
  .badge.approved { background: #cce5ff; color: #004085; }
  .empty { color: #666; font-style: italic; padding: 40px 0; text-align: center; }
`;
const renderTable = (entries, showColumn) => {
    const colHeader = showColumn === 'commit' ? 'Commit' : 'Route';
    return `<table>
  <thead><tr>
    <th>${colHeader}</th><th>Browser</th><th>Diff %</th><th>SSIM</th><th>Status</th>
  </tr></thead>
  <tbody>${entries.map((e) => renderRow(e, showColumn)).join('\n')}</tbody>
</table>`;
};
const generateChangelogHtml = (entries, groupBy) => {
    if (entries.length === 0) {
        return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Changelog</title><style>${CSS}</style></head>
<body><h1>Visual Changelog</h1><p class="empty">No visual changes recorded</p></body></html>`;
    }
    const groups = groupBy === 'route' ? groupByRoute(entries) : groupByCommit(entries);
    const sections = Object.entries(groups)
        .map(([key, group]) => {
        const heading = escapeHtml(key);
        const showColumn = groupBy === 'route' ? 'commit' : 'route';
        return `<h3>${heading}</h3>\n${renderTable(group, showColumn)}`;
    })
        .join('\n');
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Changelog</title><style>${CSS}</style></head>
<body><h1>Visual Changelog</h1>${sections}</body></html>`;
};
//# sourceMappingURL=changelog-report.js.map

/***/ })

};

//# sourceMappingURL=368.index.js.map