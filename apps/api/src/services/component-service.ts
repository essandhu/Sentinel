import { eq } from 'drizzle-orm';
import { components, type Db } from '@sentinel-vrt/db';

/**
 * List all components for a project.
 * Only extracts READ query -- mutations stay in tRPC router.
 */
export async function listComponents(db: Db, projectId: string) {
  return db
    .select()
    .from(components)
    .where(eq(components.projectId, projectId));
}
