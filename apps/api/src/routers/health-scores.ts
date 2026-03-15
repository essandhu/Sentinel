import { z } from 'zod';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb } from '@sentinel/db';
import {
  getProjectHealthScore,
  getComponentScores,
  getHealthTrend,
} from '../services/health-query-service.js';

function getDb() {
  return createDb(process.env.DATABASE_URL!);
}

export const healthScoresRouter = t.router({
  /**
   * Get the latest pre-computed project-level health score.
   * Returns { score, computedAt } or null if no scores exist.
   */
  projectScore: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const workspaceId = (ctx as any).workspaceId;

      return getProjectHealthScore(getDb(), input.projectId, workspaceId);
    }),

  /**
   * Get latest component health scores for a project, sorted worst-first.
   * Excludes components with score -1 (no data).
   */
  componentScores: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const workspaceId = (ctx as any).workspaceId;

      return getComponentScores(getDb(), input.projectId, workspaceId);
    }),

  /**
   * Get historical health score data for trend chart visualization.
   * Supports optional componentId filter for component-specific trends.
   */
  trend: workspaceProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        windowDays: z.enum(['7', '30', '90']).default('30'),
        componentId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const workspaceId = (ctx as any).workspaceId;
      const windowDays = parseInt(input.windowDays, 10);

      return getHealthTrend(getDb(), input.projectId, {
        windowDays,
        componentId: input.componentId,
        workspaceId,
      });
    }),
});
