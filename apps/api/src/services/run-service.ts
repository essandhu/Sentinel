import { desc, eq, and, count, inArray } from 'drizzle-orm';
import { captureRuns, snapshots, diffReports, projects, type Db } from '@sentinel/db';

export interface ListRunsOptions {
  projectId?: string;
  workspaceId?: string;
  limit?: number;
}

/**
 * List capture runs with totalDiffs count.
 * Supports optional filtering by projectId and workspaceId.
 */
export async function listRuns(db: Db, options: ListRunsOptions = {}) {
  const { projectId, workspaceId, limit = 50 } = options;

  const query = db
    .select({
      id: captureRuns.id,
      projectId: captureRuns.projectId,
      branchName: captureRuns.branchName,
      commitSha: captureRuns.commitSha,
      status: captureRuns.status,
      createdAt: captureRuns.createdAt,
      completedAt: captureRuns.completedAt,
      suiteName: captureRuns.suiteName,
      totalDiffs: count(diffReports.id),
    })
    .from(captureRuns)
    .leftJoin(snapshots, eq(snapshots.runId, captureRuns.id))
    .leftJoin(diffReports, eq(diffReports.snapshotId, snapshots.id))
    .innerJoin(projects, eq(captureRuns.projectId, projects.id));

  const conditions = [];
  if (workspaceId) {
    conditions.push(eq(projects.workspaceId, workspaceId));
  }
  if (projectId) {
    conditions.push(eq(captureRuns.projectId, projectId));
  }

  return query
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(captureRuns.id)
    .orderBy(desc(captureRuns.createdAt))
    .limit(limit);
}

/**
 * Get a single capture run by ID, optionally scoped to a workspace.
 * Returns the run or null if not found.
 */
export async function getRunById(db: Db, runId: string, workspaceId?: string) {
  const conditions = [eq(captureRuns.id, runId)];
  if (workspaceId) {
    conditions.push(eq(projects.workspaceId, workspaceId));
  }

  const rows = await db
    .select({
      id: captureRuns.id,
      projectId: captureRuns.projectId,
      branchName: captureRuns.branchName,
      commitSha: captureRuns.commitSha,
      status: captureRuns.status,
      createdAt: captureRuns.createdAt,
      completedAt: captureRuns.completedAt,
      suiteName: captureRuns.suiteName,
      totalDiffs: count(diffReports.id),
    })
    .from(captureRuns)
    .leftJoin(snapshots, eq(snapshots.runId, captureRuns.id))
    .leftJoin(diffReports, eq(diffReports.snapshotId, snapshots.id))
    .innerJoin(projects, eq(captureRuns.projectId, projects.id))
    .where(and(...conditions))
    .groupBy(captureRuns.id);

  return rows[0] ?? null;
}

/**
 * List capture runs for a specific project (used by REST captures endpoint).
 * Returns basic run fields without totalDiffs aggregation.
 */
export async function listRunsByProject(db: Db, projectId: string) {
  return db
    .select({
      id: captureRuns.id,
      commitSha: captureRuns.commitSha,
      branchName: captureRuns.branchName,
      status: captureRuns.status,
      source: captureRuns.source,
      createdAt: captureRuns.createdAt,
      completedAt: captureRuns.completedAt,
    })
    .from(captureRuns)
    .where(eq(captureRuns.projectId, projectId));
}
