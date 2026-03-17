import { eq, and } from 'drizzle-orm';
import { projects, type Db } from '@sentinel-vrt/db';

/**
 * List all projects for a workspace.
 */
export async function listProjects(db: Db, workspaceId: string) {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId));
}

/**
 * Get a single project by ID, optionally scoped to a workspace.
 * Returns the project or null if not found.
 */
export async function getProjectById(db: Db, projectId: string, workspaceId?: string) {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(
      workspaceId
        ? and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId))
        : eq(projects.id, projectId),
    );

  return rows[0] ?? null;
}
