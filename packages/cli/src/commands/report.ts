import chalk from 'chalk';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { initLocalRuntime } from '../local-runtime.js';

interface ReportOptions {
  run?: string;
  output?: string;
}

export async function reportCommand(options: ReportOptions): Promise<void> {
  const runtime = await initLocalRuntime(process.cwd());

  try {
    // Find target run
    let runId = options.run;
    if (!runId) {
      const latest = await runtime.db.query.captureRuns.findFirst({
        orderBy: (runs: any, { desc }: any) => [desc(runs.createdAt)],
      }) as { id: string } | undefined;
      if (!latest) {
        console.log(chalk.yellow('No runs found.'));
        return;
      }
      runId = latest.id;
    }

    // Get diffs via raw SQL (to avoid drizzle type issues)
    const diffs = (runtime.db as any).$client.prepare(`
      SELECT s.url, s.viewport, s.browser, d.pixel_diff_percent as diffPercent, d.passed
      FROM diff_reports d
      INNER JOIN snapshots s ON s.id = d.snapshot_id
      WHERE s.run_id = ?
    `).all(runId);

    const html = generateReportHtml(runId, diffs);
    const outPath = options.output ?? join(process.cwd(), '.sentinel', 'report.html');
    await writeFile(outPath, html);
    console.log(chalk.green(`Report saved to ${outPath}`));
  } finally {
    runtime.close();
  }
}

function generateReportHtml(runId: string, diffs: any[]): string {
  const rows = diffs.map((d: any) => `
    <tr>
      <td>${escapeHtml(d.url)}</td>
      <td>${escapeHtml(d.viewport)}</td>
      <td>${escapeHtml(d.browser)}</td>
      <td>${((d.diffPercent ?? 0) / 100).toFixed(2)}%</td>
      <td class="${d.passed === 'passed' ? 'pass' : 'fail'}">${escapeHtml(d.passed)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Sentinel Report — ${escapeHtml(runId.slice(0, 8))}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #f8f9fa; }
  .pass { color: #16a34a; font-weight: 600; }
  .fail { color: #dc2626; font-weight: 600; }
  h1 { color: #1e293b; }
</style>
</head><body>
<h1>Sentinel Visual Regression Report</h1>
<p>Run: <code>${escapeHtml(runId)}</code></p>
<p>Generated: ${new Date().toISOString()}</p>
<table>
  <thead><tr><th>URL</th><th>Viewport</th><th>Browser</th><th>Diff %</th><th>Status</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
