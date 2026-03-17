import { eq, and, ne, asc } from 'drizzle-orm';
import { environments } from '@sentinel-vrt/db';
import type { Db } from '@sentinel-vrt/db';

const NAME_REGEX = /^[a-z0-9-]+$/;

/**
 * List all environments for a project, ordered by name.
 */
export async function listEnvironments(db: Db, projectId: string) {
  return db
    .select()
    .from(environments)
    .where(eq(environments.projectId, projectId))
    .orderBy(asc(environments.name));
}

/**
 * Create a new environment for a project.
 * Name is normalized to lowercase and trimmed.
 * If isReference is true, clears isReference on all other envs in the same project.
 */
export async function createEnvironment(
  db: Db,
  opts: { projectId: string; name: string; baseUrl?: string; isReference?: boolean },
) {
  const name = opts.name.trim().toLowerCase();

  if (!name) {
    throw new Error('Environment name cannot be empty');
  }
  if (!NAME_REGEX.test(name)) {
    throw new Error('Environment name must be alphanumeric with hyphens only (a-z, 0-9, -)');
  }

  if (opts.isReference) {
    await db
      .update(environments)
      .set({ isReference: 0 })
      .where(eq(environments.projectId, opts.projectId));
  }

  return db.insert(environments).values({
    projectId: opts.projectId,
    name,
    baseUrl: opts.baseUrl ?? null,
    isReference: opts.isReference ? 1 : 0,
  }).returning();
}

/**
 * Update an environment's baseUrl and/or isReference flag.
 * If isReference is set to true, clears isReference on all other envs in the same project.
 */
export async function updateEnvironment(
  db: Db,
  opts: { id: string; baseUrl?: string | null; isReference?: boolean },
) {
  // If setting isReference, we need the projectId to clear others
  if (opts.isReference) {
    const [env] = await db
      .select()
      .from(environments)
      .where(eq(environments.id, opts.id));

    if (env) {
      await db
        .update(environments)
        .set({ isReference: 0 })
        .where(and(
          eq(environments.projectId, env.projectId),
          ne(environments.id, opts.id),
        ));
    }
  }

  const setFields: Record<string, unknown> = {};
  if (opts.baseUrl !== undefined) setFields.baseUrl = opts.baseUrl;
  if (opts.isReference !== undefined) setFields.isReference = opts.isReference ? 1 : 0;

  return db
    .update(environments)
    .set(setFields)
    .where(eq(environments.id, opts.id))
    .returning();
}

/**
 * Delete an environment by id.
 */
export async function deleteEnvironment(db: Db, id: string) {
  return db.delete(environments).where(eq(environments.id, id));
}
