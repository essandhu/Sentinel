import { eq, and, gte, sql, asc, isNull } from 'drizzle-orm';
import {
  approvalDecisions,
  diffReports,
  snapshots,
  captureRuns,
  projects,
} from '@sentinel-vrt/db';

export interface TeamMetrics {
  meanTimeToApproveMs: number | null;
  approvalVelocity: number;
  totalApprovals: number;
}

export interface RegressionTrendPoint {
  date: string;
  count: number;
}

/**
 * Compute team approval metrics for a project within a time window.
 * - meanTimeToApproveMs: avg(approval.createdAt - diff.createdAt) in ms
 * - approvalVelocity: totalApprovals / windowDays
 * - totalApprovals: count of approved decisions in window
 */
export async function getTeamMetrics(
  db: any,
  projectId: string,
  windowDays: number,
  workspaceId: string,
): Promise<TeamMetrics> {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const rows: Array<{ approvalCreatedAt: Date; diffCreatedAt: Date }> = await db
    .select({
      approvalCreatedAt: approvalDecisions.createdAt,
      diffCreatedAt: diffReports.createdAt,
    })
    .from(approvalDecisions)
    .innerJoin(diffReports, eq(approvalDecisions.diffReportId, diffReports.id))
    .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .innerJoin(projects, eq(captureRuns.projectId, projects.id))
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        eq(approvalDecisions.action, 'approved'),
        gte(approvalDecisions.createdAt, cutoff),
      ),
    );

  if (rows.length === 0) {
    return { meanTimeToApproveMs: null, approvalVelocity: 0, totalApprovals: 0 };
  }

  const totalApprovals = rows.length;
  const totalMs = rows.reduce((sum, row) => {
    return sum + (new Date(row.approvalCreatedAt).getTime() - new Date(row.diffCreatedAt).getTime());
  }, 0);
  const meanTimeToApproveMs = Math.round(totalMs / totalApprovals);
  const approvalVelocity = totalApprovals / windowDays;

  return { meanTimeToApproveMs, approvalVelocity, totalApprovals };
}

/**
 * Get daily regression counts (diffReports with passed='false') for a project.
 * Returns array sorted by date ascending.
 */
export async function getRegressionTrend(
  db: any,
  projectId: string,
  windowDays: number,
  workspaceId: string,
): Promise<RegressionTrendPoint[]> {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const rows: Array<{ date: string; count: number }> = await db
    .select({
      date: sql`to_char(${diffReports.createdAt}, 'YYYY-MM-DD')`,
      count: sql`count(*)::int`,
    })
    .from(diffReports)
    .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .innerJoin(projects, eq(captureRuns.projectId, projects.id))
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        eq(diffReports.passed, 'false'),
        gte(diffReports.createdAt, cutoff),
      ),
    )
    .groupBy(sql`to_char(${diffReports.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(asc(sql`to_char(${diffReports.createdAt}, 'YYYY-MM-DD')`));

  return rows.map((r) => ({ date: String(r.date), count: Number(r.count) }));
}

export interface DiffExportRow {
  url: string;
  viewport: string;
  pixelDiffPercent: number | null;
  passed: string;
  diffCreatedAt: string;
  approvalAction: string | null;
  approvalDate: string | null;
  approverEmail: string | null;
}

/**
 * Get flat diff + approval rows for CSV export.
 * Left-joins approvalDecisions so diffs without approvals still appear.
 */
export async function getDiffExportData(
  db: any,
  projectId: string,
  windowDays: number,
  workspaceId: string,
): Promise<DiffExportRow[]> {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      url: snapshots.url,
      viewport: snapshots.viewport,
      pixelDiffPercent: diffReports.pixelDiffPercent,
      passed: diffReports.passed,
      diffCreatedAt: diffReports.createdAt,
      approvalAction: approvalDecisions.action,
      approvalDate: approvalDecisions.createdAt,
      approverEmail: approvalDecisions.userEmail,
    })
    .from(diffReports)
    .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .innerJoin(projects, eq(captureRuns.projectId, projects.id))
    .leftJoin(approvalDecisions, eq(approvalDecisions.diffReportId, diffReports.id))
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        gte(diffReports.createdAt, cutoff),
      ),
    )
    .orderBy(asc(diffReports.createdAt));

  return rows.map((r: any) => ({
    url: String(r.url),
    viewport: String(r.viewport),
    pixelDiffPercent: r.pixelDiffPercent != null ? Number(r.pixelDiffPercent) / 100 : null,
    passed: String(r.passed),
    diffCreatedAt: r.diffCreatedAt instanceof Date ? r.diffCreatedAt.toISOString() : String(r.diffCreatedAt),
    approvalAction: r.approvalAction ?? null,
    approvalDate: r.approvalDate instanceof Date ? r.approvalDate.toISOString() : r.approvalDate ?? null,
    approverEmail: r.approverEmail ?? null,
  }));
}
