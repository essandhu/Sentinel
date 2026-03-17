import { z } from 'zod';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb } from '@sentinel-vrt/db';
import { getDiffsByRunId } from '../services/diff-service.js';

export const diffsRouter = t.router({
  byRunId: workspaceProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const db = createDb(process.env.DATABASE_URL!);

      return getDiffsByRunId(db, input.runId, ctx.workspaceId);
    }),
});
