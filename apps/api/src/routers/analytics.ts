import { z } from 'zod';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb } from '@sentinel-vrt/db';
import { getTeamMetrics, getRegressionTrend, getDiffExportData } from '../services/analytics-service.js';

function getDb() {
  return createDb(process.env.DATABASE_URL!);
}

export const analyticsRouter = t.router({
  /**
   * Get team approval metrics: mean time-to-approve, approval velocity, total approvals.
   */
  teamMetrics: workspaceProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        windowDays: z.enum(['30', '60', '90']).default('30'),
      }),
    )
    .query(async ({ input, ctx }) => {
      const workspaceId = (ctx as any).workspaceId;
      const windowDays = parseInt(input.windowDays, 10);

      return getTeamMetrics(getDb(), input.projectId, windowDays, workspaceId);
    }),

  /**
   * Get daily regression counts for trend chart visualization.
   */
  regressionTrend: workspaceProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        windowDays: z.enum(['30', '60', '90']).default('30'),
      }),
    )
    .query(async ({ input, ctx }) => {
      const workspaceId = (ctx as any).workspaceId;
      const windowDays = parseInt(input.windowDays, 10);

      return getRegressionTrend(getDb(), input.projectId, windowDays, workspaceId);
    }),

  /**
   * Get flat diff + approval rows for CSV export.
   */
  diffExport: workspaceProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        windowDays: z.enum(['30', '60', '90']).default('30'),
      }),
    )
    .query(async ({ input, ctx }) => {
      const workspaceId = (ctx as any).workspaceId;
      const windowDays = parseInt(input.windowDays, 10);

      return getDiffExportData(getDb(), input.projectId, windowDays, workspaceId);
    }),
});
