import { z } from 'zod';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb } from '@sentinel-vrt/db';
import {
  getViolationsByRunId,
  getA11ySummaryByProject,
} from '../services/a11y-service.js';

function getDb() {
  return createDb(process.env.DATABASE_URL!);
}

// Re-export service functions under original names for backward compatibility
export {
  getViolationsByRunId as byRunIdHandler,
  getA11ySummaryByProject as byProjectHandler,
} from '../services/a11y-service.js';

export const a11yRouter = t.router({
  /**
   * Get violations for a specific capture run, grouped by status.
   */
  byRunId: workspaceProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ input }) => {
      return getViolationsByRunId(getDb(), input.runId);
    }),

  /**
   * Get latest a11y summary for a project.
   */
  byProject: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return getA11ySummaryByProject(getDb(), input.projectId);
    }),
});
