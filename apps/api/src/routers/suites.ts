import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb, testSuites, type Db } from '@sentinel/db';

function getDb() {
  return createDb(process.env.DATABASE_URL!);
}

/** List all test suites for a project (exported for unit testing) */
export async function listHandler(db: Db, projectId: string) {
  return db
    .select()
    .from(testSuites)
    .where(eq(testSuites.projectId, projectId))
    .orderBy(testSuites.name);
}

/** Create or return existing suite (exported for unit testing) */
export async function upsertHandler(db: Db, projectId: string, name: string) {
  const existing = await db
    .select()
    .from(testSuites)
    .where(
      and(
        eq(testSuites.projectId, projectId),
        eq(testSuites.name, name),
      ),
    );

  if (existing.length > 0) {
    return existing[0];
  }

  const inserted = await db
    .insert(testSuites)
    .values({ projectId, name })
    .returning();

  return inserted[0];
}

export const suitesRouter = t.router({
  list: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => listHandler(getDb(), input.projectId)),

  upsert: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid(), name: z.string().min(1) }))
    .mutation(async ({ input }) => upsertHandler(getDb(), input.projectId, input.name)),
});
