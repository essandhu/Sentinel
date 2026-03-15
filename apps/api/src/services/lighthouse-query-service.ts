import { eq, and, desc, lt } from 'drizzle-orm';
import { lighthouseScores, captureRuns, performanceBudgets, type Db } from '@sentinel/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerformanceThresholds {
  performance?: number;
  accessibility?: number;
  bestPractices?: number;
  seo?: number;
}

export interface PerformanceRegression {
  url: string;
  category: string;
  previousScore: number;
  currentScore: number;
  threshold: number;
}

const DEFAULT_THRESHOLDS: Required<PerformanceThresholds> = {
  performance: 80,
  accessibility: 80,
  bestPractices: 80,
  seo: 80,
};

const CATEGORY_KEYS = ['performance', 'accessibility', 'bestPractices', 'seo'] as const;

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Get all lighthouse score rows for a capture run.
 */
export async function getLighthouseScores(db: Db, captureRunId: string) {
  return db
    .select()
    .from(lighthouseScores)
    .where(eq(lighthouseScores.captureRunId, captureRunId));
}

/**
 * Get lighthouse score trend for a project+url pair, ordered chronologically.
 */
export async function getLighthouseTrend(
  db: Db,
  projectId: string,
  url: string,
  options?: { limit?: number },
) {
  const limit = options?.limit ?? 20;
  const rows = await db
    .select()
    .from(lighthouseScores)
    .where(
      and(
        eq(lighthouseScores.projectId, projectId),
        eq(lighthouseScores.url, url),
      ),
    )
    .orderBy(desc(lighthouseScores.createdAt))
    .limit(limit);
  return rows.reverse(); // chronological order
}

/**
 * Get distinct URLs that have lighthouse scores for a project.
 */
export async function getRouteUrls(db: Db, projectId: string) {
  return db
    .selectDistinct({ url: lighthouseScores.url })
    .from(lighthouseScores)
    .where(eq(lighthouseScores.projectId, projectId));
}

/**
 * Detect performance regressions by comparing current run scores against the
 * most recent previous run. A regression is flagged when the current score
 * drops below the threshold AND is lower than the previous score.
 */
export async function detectPerformanceRegressions(
  db: Db,
  projectId: string,
  currentRunId: string,
  thresholds?: PerformanceThresholds,
): Promise<PerformanceRegression[]> {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };

  // Find the most recent run BEFORE currentRunId for this project
  const [currentRun] = await db
    .select({ id: captureRuns.id, createdAt: captureRuns.createdAt })
    .from(captureRuns)
    .where(eq(captureRuns.id, currentRunId))
    .limit(1);

  if (!currentRun) return [];

  const [previousRun] = await db
    .select({ id: captureRuns.id, createdAt: captureRuns.createdAt })
    .from(captureRuns)
    .where(
      and(
        eq(captureRuns.projectId, projectId),
        lt(captureRuns.createdAt, currentRun.createdAt),
      ),
    )
    .orderBy(desc(captureRuns.createdAt))
    .limit(1);

  if (!previousRun) return [];

  // Get scores for both runs
  const currentScores = await db
    .select()
    .from(lighthouseScores)
    .where(eq(lighthouseScores.captureRunId, currentRunId));

  const previousScores = await db
    .select()
    .from(lighthouseScores)
    .where(eq(lighthouseScores.captureRunId, previousRun.id));

  // Index previous scores by url for O(1) lookup
  const prevByUrl = new Map<string, (typeof previousScores)[number]>();
  for (const row of previousScores) {
    prevByUrl.set(row.url, row);
  }

  const regressions: PerformanceRegression[] = [];

  for (const current of currentScores) {
    const prev = prevByUrl.get(current.url);
    if (!prev) continue;

    for (const cat of CATEGORY_KEYS) {
      const currentScore = current[cat];
      const previousScore = prev[cat];
      const threshold = t[cat];

      if (currentScore < threshold && currentScore < previousScore) {
        regressions.push({
          url: current.url,
          category: cat,
          previousScore,
          currentScore,
          threshold,
        });
      }
    }
  }

  return regressions;
}

// ---------------------------------------------------------------------------
// Budget evaluation
// ---------------------------------------------------------------------------

export interface BudgetResult {
  url: string;
  category: string;
  score: number;
  budget: number;
  passed: boolean;
}

export interface RouteBudget {
  route: string;
  performance?: number;
  accessibility?: number;
  bestPractices?: number;
  seo?: number;
}

/**
 * Evaluate lighthouse scores against budget thresholds.
 * Route-specific budgets override global thresholds for matching routes.
 * Only categories with a defined budget are checked.
 */
export function evaluateBudgets(
  scores: { performance: number; accessibility: number; bestPractices: number; seo: number },
  url: string,
  globalThresholds: PerformanceThresholds,
  routeBudgets?: RouteBudget[],
): BudgetResult[] {
  const results: BudgetResult[] = [];
  const matchingRoute = routeBudgets?.find(b => b.route === url);

  for (const cat of CATEGORY_KEYS) {
    // Route-specific budget takes priority over global threshold
    const routeBudget = matchingRoute?.[cat];
    const globalBudget = globalThresholds[cat];
    const effectiveBudget = routeBudget ?? globalBudget;

    if (effectiveBudget == null) continue;

    results.push({
      url,
      category: cat,
      score: scores[cat],
      budget: effectiveBudget,
      passed: scores[cat] >= effectiveBudget,
    });
  }

  return results;
}

/**
 * Get all performance budgets for a project.
 */
export async function getBudgets(db: Db, projectId: string) {
  return db
    .select()
    .from(performanceBudgets)
    .where(eq(performanceBudgets.projectId, projectId));
}

/**
 * Upsert budgets for a project. Deletes existing budgets then inserts new ones.
 */
export async function upsertBudgets(
  db: Db,
  projectId: string,
  budgets: RouteBudget[],
) {
  // Delete existing budgets for this project
  await db
    .delete(performanceBudgets)
    .where(eq(performanceBudgets.projectId, projectId));

  if (budgets.length === 0) return [];

  // Insert new budgets
  return db
    .insert(performanceBudgets)
    .values(
      budgets.map(b => ({
        projectId,
        route: b.route,
        performance: b.performance ?? null,
        accessibility: b.accessibility ?? null,
        bestPractices: b.bestPractices ?? null,
        seo: b.seo ?? null,
      })),
    )
    .returning();
}

/**
 * Compute the average performance score across all URLs from the latest run.
 * Returns -1 if no data exists.
 */
export async function computeAveragePerfScore(
  db: Db,
  projectId: string,
): Promise<number> {
  // Get latest run for project
  const [latestRun] = await db
    .select({ id: captureRuns.id })
    .from(captureRuns)
    .where(eq(captureRuns.projectId, projectId))
    .orderBy(desc(captureRuns.createdAt))
    .limit(1);

  if (!latestRun) return -1;

  const scores = await db
    .select()
    .from(lighthouseScores)
    .where(eq(lighthouseScores.captureRunId, latestRun.id));

  if (scores.length === 0) return -1;

  const sum = scores.reduce((acc, row) => acc + row.performance, 0);
  return Math.round(sum / scores.length);
}
