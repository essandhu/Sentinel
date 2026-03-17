import { z } from 'zod';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb } from '@sentinel-vrt/db';
import { listRuns, getRunById } from '../services/run-service.js';

export const runsRouter = t.router({
  list: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid() }).optional())
    .query(async ({ input, ctx }) => {
      const db = createDb(process.env.DATABASE_URL!);

      return listRuns(db, {
        projectId: input?.projectId,
        workspaceId: ctx.workspaceId,
      });
    }),

  get: workspaceProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const db = createDb(process.env.DATABASE_URL!);
      return getRunById(db, input.runId, ctx.workspaceId);
    }),
});
