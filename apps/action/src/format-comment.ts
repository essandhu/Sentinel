import type { DiffSummary, BudgetResultEntry } from '@sentinel/cli';

/**
 * Format budget results into a markdown table section.
 */
function formatBudgetSection(budgetResults: BudgetResultEntry[]): string {
  const heading = '## :chart_with_upwards_trend: Performance Budget';

  const tableHeader = [
    '| Route | Metric | Score | Budget | Status |',
    '|-------|--------|-------|--------|--------|',
  ].join('\n');

  const rows = budgetResults.map((r) => {
    const statusCell = r.passed ? ':white_check_mark:' : ':x:';
    return `| ${r.url} | ${r.category} | ${r.score} | ${r.budget} | ${statusCell} |`;
  });

  return [heading, '', tableHeader, ...rows].join('\n');
}

/**
 * Check if a diff entry matches a flaky route.
 */
function findFlakyRoute(summary: DiffSummary, url: string, viewport: string) {
  if (!summary.flakyRoutes || summary.flakyRoutes.length === 0) return null;
  return summary.flakyRoutes.find(
    (fr) => fr.url === url && fr.viewport === viewport,
  ) ?? null;
}

/**
 * Format a DiffSummary into a GitHub-flavored Markdown comment body.
 */
export function formatComment(summary: DiffSummary, dashboardUrl?: string): string {
  const statusIcon = summary.allPassed ? ':white_check_mark:' : ':x:';
  const heading = `## ${statusIcon} Sentinel Visual Diff`;

  const tableHeader = [
    '| Route | Viewport | Pixel Diff | SSIM | Status | Preview |',
    '|-------|----------|------------|------|--------|---------|',
  ].join('\n');

  const rows = summary.diffs.map((diff) => {
    const pixelDiff = `${diff.pixelDiffPercent.toFixed(2)}%`;
    const ssim = diff.ssimScore != null ? diff.ssimScore.toFixed(4) : 'N/A';
    const preview =
      dashboardUrl ? `[View](${dashboardUrl}/images/${diff.diffS3Key})` : 'N/A';

    // Check if this failed diff is a flaky route
    const flakyRoute = !diff.passed ? findFlakyRoute(summary, diff.url, diff.viewport) : null;
    const statusCell = diff.passed
      ? ':white_check_mark:'
      : flakyRoute
        ? `\u26A0 (stability: ${flakyRoute.stabilityScore}%)`
        : ':x:';

    return `| ${diff.url} | ${diff.viewport} | ${pixelDiff} | ${ssim} | ${statusCell} | ${preview} |`;
  });

  const failedCount = summary.failedCount;
  const summaryLine = summary.allPassed
    ? `**All ${summary.diffs.length} route(s) passed.**`
    : `**${failedCount} of ${summary.diffs.length} route(s) failed.**`;

  const parts = [heading, '', summaryLine, '', tableHeader, ...rows];

  // Append flaky routes warning if applicable
  const flakyFailureCount = summary.flakyFailureCount ?? 0;
  if (flakyFailureCount > 0) {
    parts.push('', `> :warning: ${flakyFailureCount} failure(s) from unstable routes (may be environmental noise)`);
  }

  // Append budget section if budget results are present
  if (summary.budgetResults && summary.budgetResults.length > 0) {
    parts.push('', formatBudgetSection(summary.budgetResults));
  }

  return parts.join('\n');
}
