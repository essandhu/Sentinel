import { z } from 'zod';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb } from '@sentinel/db';
import { globalSearch } from '../services/search-service.js';

function getDb() {
  return createDb(process.env.DATABASE_URL!);
}

export const searchRouter = t.router({
  /**
   * Full-text search across routes, components, and diffs.
   * Returns up to 10 results per category, scoped by project and workspace.
   */
  query: workspaceProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        q: z.string().min(2).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const workspaceId = (ctx as any).workspaceId;
      return globalSearch(getDb(), input.projectId, input.q, workspaceId);
    }),
});
