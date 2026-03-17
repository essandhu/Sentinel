import { eq, and, desc, gte, isNull, isNotNull, ne } from 'drizzle-orm';
import { healthScores, projects, components, type Db } from '@sentinel-vrt/db';

/**
 * Get the latest pre-computed project-level health score.
 * Returns { score, computedAt } or null if no scores exist.
 */
export async function getProjectHealthScore(db: Db, projectId: string, workspaceId?: string) {
  const conditions = [
    eq(healthScores.projectId, projectId),
    isNull(healthScores.componentId),
  ];

  if (workspaceId) {
    conditions.push(eq(projects.workspaceId, workspaceId));
  }

  const rows = await db
    .select({
      score: healthScores.score,
      computedAt: healthScores.computedAt,
    })
    .from(healthScores)
    .innerJoin(projects, eq(healthScores.projectId, projects.id))
    .where(and(...conditions))
    .orderBy(desc(healthScores.computedAt))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Get latest component health scores for a project, sorted worst-first.
 * Deduplicates by componentId keeping only the latest computedAt entry.
 * Excludes components with score -1 (no data).
 */
export async function getComponentScores(db: Db, projectId: string, workspaceId?: string) {
  const conditions = [
    eq(healthScores.projectId, projectId),
    isNotNull(healthScores.componentId),
    ne(healthScores.score, -1),
  ];

  if (workspaceId) {
    conditions.push(eq(projects.workspaceId, workspaceId));
  }

  const allRows = await db
    .select({
      componentId: healthScores.componentId,
      componentName: components.name,
      score: healthScores.score,
      computedAt: healthScores.computedAt,
    })
    .from(healthScores)
    .innerJoin(projects, eq(healthScores.projectId, projects.id))
    .innerJoin(components, eq(healthScores.componentId, components.id))
    .where(and(...conditions))
    .orderBy(desc(healthScores.computedAt));

  // Sort by computedAt desc to ensure latest entries come first
  const sorted = [...allRows].sort(
    (a, b) => new Date(b.computedAt!).getTime() - new Date(a.computedAt!).getTime(),
  );

  // Deduplicate: keep first (latest computedAt) entry per componentId
  const seen = new Set<string>();
  const rows = sorted
    .filter((row) => {
      if (seen.has(row.componentId!)) return false;
      seen.add(row.componentId!);
      return true;
    })
    .sort((a, b) => a.score - b.score);

  return rows;
}

export interface HealthTrendOptions {
  windowDays?: number;
  componentId?: string;
}

/**
 * Get historical health score data for trend chart visualization.
 * Supports optional componentId filter for component-specific trends.
 */
export async function getHealthTrend(
  db: Db,
  projectId: string,
  options: HealthTrendOptions & { workspaceId?: string } = {},
) {
  const { windowDays = 30, componentId, workspaceId } = options;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const conditions = [
    eq(healthScores.projectId, projectId),
    gte(healthScores.computedAt, cutoff),
  ];

  if (componentId) {
    conditions.push(eq(healthScores.componentId, componentId));
  } else {
    conditions.push(isNull(healthScores.componentId));
  }

  if (workspaceId) {
    conditions.push(eq(projects.workspaceId, workspaceId));
  }

  return db
    .select({
      score: healthScores.score,
      computedAt: healthScores.computedAt,
    })
    .from(healthScores)
    .innerJoin(projects, eq(healthScores.projectId, projects.id))
    .where(and(...conditions))
    .orderBy(healthScores.computedAt);
}

/**
 * List all health scores for a project (used by REST v1 endpoint).
 */
export async function listHealthScores(db: Db, projectId: string) {
  return db
    .select({
      id: healthScores.id,
      componentId: healthScores.componentId,
      score: healthScores.score,
      windowDays: healthScores.windowDays,
      computedAt: healthScores.computedAt,
    })
    .from(healthScores)
    .where(eq(healthScores.projectId, projectId));
}
