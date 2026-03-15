import { z } from 'zod';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb } from '@sentinel/db';
import {
  getLighthouseScores,
  getLighthouseTrend,
  detectPerformanceRegressions,
  getRouteUrls,
  getBudgets,
  upsertBudgets,
  evaluateBudgets,
} from '../services/lighthouse-query-service.js';

function getDb() {
  return createDb(process.env.DATABASE_URL!);
}

export const lighthouseRouter = t.router({
  /** Get lighthouse scores for a specific capture run */
  scores: workspaceProcedure
    .input(z.object({ captureRunId: z.string().uuid() }))
    .query(async ({ input }) => {
      return getLighthouseScores(getDb(), input.captureRunId);
    }),

  /** Get performance score trend for a specific route over time */
  trend: workspaceProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      url: z.string(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      return getLighthouseTrend(getDb(), input.projectId, input.url, { limit: input.limit });
    }),

  /** Detect performance regressions for a capture run */
  regressions: workspaceProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      captureRunId: z.string().uuid(),
      thresholds: z.object({
        performance: z.number().min(0).max(100).optional(),
        accessibility: z.number().min(0).max(100).optional(),
        bestPractices: z.number().min(0).max(100).optional(),
        seo: z.number().min(0).max(100).optional(),
      }).optional(),
    }))
    .query(async ({ input }) => {
      return detectPerformanceRegressions(
        getDb(), input.projectId, input.captureRunId, input.thresholds,
      );
    }),

  /** Get distinct route URLs with lighthouse data for a project */
  routeUrls: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return getRouteUrls(getDb(), input.projectId);
    }),

  /** List all performance budgets for a project */
  budgetsList: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return getBudgets(getDb(), input.projectId);
    }),

  /** Create/update performance budgets for a project */
  budgetsUpsert: workspaceProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      budgets: z.array(z.object({
        route: z.string().startsWith('/'),
        performance: z.number().int().min(0).max(100).optional(),
        accessibility: z.number().int().min(0).max(100).optional(),
        bestPractices: z.number().int().min(0).max(100).optional(),
        seo: z.number().int().min(0).max(100).optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      return upsertBudgets(getDb(), input.projectId, input.budgets);
    }),

  /** Evaluate performance budgets against a capture run's scores */
  budgetsEvaluate: workspaceProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      captureRunId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const scores = await getLighthouseScores(db, input.captureRunId);
      const budgets = await getBudgets(db, input.projectId);

      const routeBudgets = budgets.map(b => ({
        route: b.route,
        performance: b.performance ?? undefined,
        accessibility: b.accessibility ?? undefined,
        bestPractices: b.bestPractices ?? undefined,
        seo: b.seo ?? undefined,
      }));

      const allResults = scores.flatMap(scoreRow =>
        evaluateBudgets(
          {
            performance: scoreRow.performance,
            accessibility: scoreRow.accessibility,
            bestPractices: scoreRow.bestPractices,
            seo: scoreRow.seo,
          },
          scoreRow.url,
          {}, // no global thresholds; budgets are per-route
          routeBudgets,
        ),
      );

      const overallPassed = allResults.every(r => r.passed);

      return {
        results: allResults,
        passed: overallPassed,
        totalChecks: allResults.length,
        failedChecks: allResults.filter(r => !r.passed).length,
      };
    }),
});
