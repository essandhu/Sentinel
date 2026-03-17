import { eq, and } from 'drizzle-orm';
import { diffReports, snapshots, captureRuns, projects, type Db } from '@sentinel-vrt/db';

/**
 * Get diff reports for a given run, joined with snapshot fields.
 * Used by both the tRPC diffs router and the REST v1 diffs route.
 *
 * The tRPC version returns more fields (s3 keys, browser) while the REST
 * version flattens snapshot fields. Both call this function and transform
 * the result as needed.
 */
export async function getDiffsByRunId(db: Db, runId: string, workspaceId?: string) {
  return db
    .select({
      id: diffReports.id,
      snapshotId: diffReports.snapshotId,
      snapshotS3Key: snapshots.s3Key,
      url: snapshots.url,
      viewport: snapshots.viewport,
      browser: snapshots.browser,
      baselineS3Key: diffReports.baselineS3Key,
      diffS3Key: diffReports.diffS3Key,
      pixelDiffPercent: diffReports.pixelDiffPercent,
      ssimScore: diffReports.ssimScore,
      passed: diffReports.passed,
      createdAt: diffReports.createdAt,
      breakpointName: snapshots.breakpointName,
      parameterName: snapshots.parameterName,
    })
    .from(diffReports)
    .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .innerJoin(projects, eq(captureRuns.projectId, projects.id))
    .where(
      and(
        eq(snapshots.runId, runId),
        ...(workspaceId ? [eq(projects.workspaceId, workspaceId)] : []),
      ),
    );
}

/**
 * Verify a capture run belongs to a workspace.
 * Returns the run row or null if not found.
 */
export async function verifyRunInWorkspace(db: Db, runId: string, workspaceId: string) {
  const rows = await db
    .select({
      id: captureRuns.id,
      projectId: captureRuns.projectId,
      status: captureRuns.status,
      commitSha: captureRuns.commitSha,
      branchName: captureRuns.branchName,
      source: captureRuns.source,
      createdAt: captureRuns.createdAt,
      completedAt: captureRuns.completedAt,
    })
    .from(captureRuns)
    .innerJoin(projects, eq(captureRuns.projectId, projects.id))
    .where(and(eq(captureRuns.id, runId), eq(projects.workspaceId, workspaceId)));

  return rows[0] ?? null;
}
