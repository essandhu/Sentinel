import { eq, and, ilike } from 'drizzle-orm';
import {
  snapshots,
  captureRuns,
  projects,
  components,
  diffReports,
  type Db,
} from '@sentinel/db';

export interface SearchResults {
  routes: Array<{ url: string; runId: string }>;
  components: Array<{ id: string; name: string }>;
  diffs: Array<{ id: string; url: string; pixelDiffPercent: number | null }>;
}

const EMPTY_RESULTS: SearchResults = { routes: [], components: [], diffs: [] };

/**
 * Full-text search across snapshots (routes), components, and diff reports.
 * Uses ILIKE for case-insensitive substring matching.
 * Results are limited to 10 per category and scoped by project + workspace.
 */
export async function globalSearch(
  db: Db,
  projectId: string,
  query: string,
  workspaceId?: string,
): Promise<SearchResults> {
  if (!query || query.length < 2) {
    return EMPTY_RESULTS;
  }

  const pattern = `%${query}%`;

  const projectConditions = [
    eq(captureRuns.projectId, projectId),
  ];

  if (workspaceId) {
    projectConditions.push(eq(projects.workspaceId, workspaceId) as any);
  }

  const [routes, comps, diffs] = await Promise.all([
    // Routes: distinct snapshot URLs matching query
    db
      .selectDistinct({
        url: snapshots.url,
        runId: snapshots.runId,
      })
      .from(snapshots)
      .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
      .innerJoin(projects, eq(captureRuns.projectId, projects.id))
      .where(
        and(
          ilike(snapshots.url, pattern),
          eq(captureRuns.projectId, projectId),
          ...(workspaceId ? [eq(projects.workspaceId, workspaceId)] : []),
        ),
      )
      .limit(10),

    // Components: matching by name
    db
      .select({
        id: components.id,
        name: components.name,
      })
      .from(components)
      .innerJoin(projects, eq(components.projectId, projects.id))
      .where(
        and(
          ilike(components.name, pattern),
          eq(components.projectId, projectId),
          ...(workspaceId ? [eq(projects.workspaceId, workspaceId)] : []),
        ),
      )
      .limit(10),

    // Diffs: failed diff reports with matching snapshot URL
    db
      .select({
        id: diffReports.id,
        url: snapshots.url,
        pixelDiffPercent: diffReports.pixelDiffPercent,
      })
      .from(diffReports)
      .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
      .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
      .innerJoin(projects, eq(captureRuns.projectId, projects.id))
      .where(
        and(
          ilike(snapshots.url, pattern),
          eq(captureRuns.projectId, projectId),
          eq(diffReports.passed, 'false'),
          ...(workspaceId ? [eq(projects.workspaceId, workspaceId)] : []),
        ),
      )
      .limit(10),
  ]);

  return {
    routes,
    components: comps,
    diffs,
  };
}
