/**
 * PDF report generation for Sentinel project analytics.
 *
 * Uses jsPDF + jspdf-autotable to create structured reports with
 * health score trends, regression data, and team metrics.
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export interface ProjectReportData {
  projectName: string;
  generatedAt: string;
  windowDays: number;
  healthTrend: Array<{ date: string; score: number }>;
  regressionTrend: Array<{ date: string; count: number }>;
  teamMetrics: {
    meanTimeToApproveMs: number | null;
    approvalVelocity: number;
    totalApprovals: number;
  };
}

function formatDuration(ms: number | null): string {
  if (ms === null) return 'N/A';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Generate and download a PDF project report.
 *
 * Includes:
 * - Title and generation metadata
 * - Health Score Trend table
 * - Regression Frequency table
 * - Team Metrics summary table
 */
export function generateProjectReport(data: ProjectReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.text(`Sentinel Project Report - ${data.projectName}`, 14, y);
  y += 10;

  // Subtitle
  doc.setFontSize(11);
  doc.text(`Generated: ${data.generatedAt} | Window: ${data.windowDays} days`, 14, y);
  y += 12;

  // Health Score Trend section
  doc.setFontSize(14);
  doc.text('Health Score Trend', 14, y);
  y += 2;

  (doc as any).autoTable({
    startY: y,
    head: [['Date', 'Score']],
    body: data.healthTrend.map((d) => [d.date, d.score.toString()]),
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // Regression Frequency section
  doc.setFontSize(14);
  doc.text('Regression Frequency', 14, y);
  y += 2;

  (doc as any).autoTable({
    startY: y,
    head: [['Date', 'Count']],
    body: data.regressionTrend.map((d) => [d.date, d.count.toString()]),
    theme: 'grid',
    headStyles: { fillColor: [239, 68, 68] },
    margin: { left: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // Team Metrics section
  doc.setFontSize(14);
  doc.text('Team Metrics', 14, y);
  y += 2;

  (doc as any).autoTable({
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Mean Time to Approve', formatDuration(data.teamMetrics.meanTimeToApproveMs)],
      ['Approval Velocity (per day)', data.teamMetrics.approvalVelocity.toFixed(2)],
      ['Total Approvals', data.teamMetrics.totalApprovals.toString()],
    ],
    theme: 'grid',
    headStyles: { fillColor: [34, 197, 94] },
    margin: { left: 14 },
  });

  doc.save(`sentinel-report-${data.projectName}-${data.generatedAt}.pdf`);
}
