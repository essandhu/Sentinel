import { z } from 'zod';
import { workspaceProcedure } from '../trpc.js';
import { t } from '../trpc.js';
import { listProjects } from '../services/project-service.js';
import { createDb, projects } from '@sentinel-vrt/db';

const db = createDb(process.env.DATABASE_URL!);

export const projectsRouter = t.router({
  /**
   * List all projects for the current workspace.
   */
  list: workspaceProcedure.query(async ({ ctx }) => {
    return listProjects(db, (ctx as any).workspaceId);
  }),

  /**
   * Create a new project in the current workspace.
   */
  create: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        repositoryUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const rows = await db
        .insert(projects)
        .values({
          name: input.name,
          workspaceId: (ctx as any).workspaceId,
        })
        .returning();
      return rows[0];
    }),
});
