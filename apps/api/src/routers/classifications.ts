import { z } from 'zod';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb } from '@sentinel/db';
import {
  getClassificationsByRunId,
  submitOverride,
  getLayoutShiftsByDiffReportId,
} from '../services/classification-service.js';

function getDb() {
  return createDb(process.env.DATABASE_URL!);
}

const categoryEnum = z.enum(['layout', 'style', 'content', 'cosmetic']);

// Re-export service functions for backward compatibility
export { getClassificationsByRunId, submitOverride } from '../services/classification-service.js';

export const classificationsRouter = t.router({
  /**
   * Get classifications for all diffs in a capture run, with nested region data.
   */
  byRunId: workspaceProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ input }) => {
      return getClassificationsByRunId(getDb(), input.runId);
    }),

  /**
   * Get layout shifts for a specific diff report.
   */
  layoutShifts: workspaceProcedure
    .input(z.object({ diffReportId: z.string().uuid() }))
    .query(async ({ input }) => {
      return getLayoutShiftsByDiffReportId(getDb(), input.diffReportId);
    }),

  /**
   * Submit a user override for a diff classification.
   * Stores the original and new category for ML training data.
   */
  override: workspaceProcedure
    .input(
      z.object({
        diffReportId: z.string().uuid(),
        overrideCategory: categoryEnum,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Use auth userId if available, fallback to 'anonymous' for dev/test
      const userId = (ctx as any).auth?.userId ?? 'anonymous';
      return submitOverride(getDb(), input.diffReportId, input.overrideCategory, userId);
    }),
});
