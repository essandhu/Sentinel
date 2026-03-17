import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Test UUIDs ----------
const PROJ_ID = '00000000-0000-4000-a000-000000000001';
const RUN_ID_CURRENT = '00000000-0000-4000-a000-000000000100';
const RUN_ID_PREVIOUS = '00000000-0000-4000-a000-000000000099';

// ---------- Chainable mock DB ----------
function buildMockDb(selectResponses: unknown[][] = []) {
  let selectCallIdx = 0;

  const makeSelectChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.groupBy = vi.fn(() => chain);
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(fn);
    return chain;
  };

  const db: Record<string, any> = {
    select: vi.fn((..._args: unknown[]) => {
      const response = selectResponses[selectCallIdx] ?? [];
      selectCallIdx++;
      return makeSelectChain(response);
    }),
    selectDistinct: vi.fn((..._args: unknown[]) => {
      const response = selectResponses[selectCallIdx] ?? [];
      selectCallIdx++;
      return makeSelectChain(response);
    }),
  };

  return db;
}

// Mock @sentinel-vrt/db
vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(),
  lighthouseScores: {
    id: 'lighthouseScores.id',
    captureRunId: 'lighthouseScores.captureRunId',
    projectId: 'lighthouseScores.projectId',
    url: 'lighthouseScores.url',
    viewport: 'lighthouseScores.viewport',
    performance: 'lighthouseScores.performance',
    accessibility: 'lighthouseScores.accessibility',
    bestPractices: 'lighthouseScores.bestPractices',
    seo: 'lighthouseScores.seo',
    createdAt: 'lighthouseScores.createdAt',
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.projectId',
    status: 'captureRuns.status',
    createdAt: 'captureRuns.createdAt',
    completedAt: 'captureRuns.completedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  lt: vi.fn((a, b) => ({ _type: 'lt', a, b })),
  avg: vi.fn((col) => ({ _type: 'avg', col })),
  ne: vi.fn((a, b) => ({ _type: 'ne', a, b })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
    { raw: vi.fn((s: string) => ({ _type: 'sql_raw', s })) },
  ),
}));

import {
  getLighthouseScores,
  getLighthouseTrend,
  detectPerformanceRegressions,
  computeAveragePerfScore,
  getRouteUrls,
  evaluateBudgets,
} from './lighthouse-query-service.js';

describe('lighthouse-query-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- getLighthouseScores ----------
  describe('getLighthouseScores', () => {
    it('returns scores for a given captureRunId', async () => {
      const rows = [
        { id: '1', captureRunId: RUN_ID_CURRENT, url: 'https://a.com', viewport: '1920x1080', performance: 95, accessibility: 90, bestPractices: 85, seo: 80 },
        { id: '2', captureRunId: RUN_ID_CURRENT, url: 'https://b.com', viewport: '1920x1080', performance: 88, accessibility: 92, bestPractices: 90, seo: 85 },
      ];
      const db = buildMockDb([rows]);

      const result = await getLighthouseScores(db as any, RUN_ID_CURRENT);
      expect(result).toEqual(rows);
      expect(result).toHaveLength(2);
    });
  });

  // ---------- getLighthouseTrend ----------
  describe('getLighthouseTrend', () => {
    it('returns chronological score data for a project+url pair', async () => {
      const rows = [
        { performance: 90, createdAt: new Date('2026-03-09'), captureRunId: 'r2' },
        { performance: 85, createdAt: new Date('2026-03-08'), captureRunId: 'r1' },
      ];
      const db = buildMockDb([rows]);

      const result = await getLighthouseTrend(db as any, PROJ_ID, 'https://a.com');
      // Should be reversed to chronological order
      expect(result[0].captureRunId).toBe('r1');
      expect(result[1].captureRunId).toBe('r2');
    });
  });

  // ---------- detectPerformanceRegressions ----------
  describe('detectPerformanceRegressions', () => {
    it('returns empty array when no previous run exists', async () => {
      const db = buildMockDb([
        // Query 0: find current run
        [{ id: RUN_ID_CURRENT, createdAt: new Date('2026-03-09') }],
        // Query 1: find previous run -- empty
        [],
      ]);

      const result = await detectPerformanceRegressions(db as any, PROJ_ID, RUN_ID_CURRENT);
      expect(result).toEqual([]);
    });

    it('returns regression objects when current score drops below threshold', async () => {
      const db = buildMockDb([
        // Query 0: find current run
        [{ id: RUN_ID_CURRENT, createdAt: new Date('2026-03-09') }],
        // Query 1: find previous run
        [{ id: RUN_ID_PREVIOUS, createdAt: new Date('2026-03-08') }],
        // Query 2: current run scores
        [{ url: 'https://a.com', viewport: '1920x1080', performance: 70, accessibility: 90, bestPractices: 85, seo: 80 }],
        // Query 3: previous run scores
        [{ url: 'https://a.com', viewport: '1920x1080', performance: 95, accessibility: 90, bestPractices: 85, seo: 80 }],
      ]);

      const result = await detectPerformanceRegressions(db as any, PROJ_ID, RUN_ID_CURRENT);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        url: 'https://a.com',
        category: 'performance',
        previousScore: 95,
        currentScore: 70,
        threshold: 80,
      });
    });

    it('uses default thresholds (80) when none configured', async () => {
      const db = buildMockDb([
        [{ id: RUN_ID_CURRENT, createdAt: new Date('2026-03-09') }],
        [{ id: RUN_ID_PREVIOUS, createdAt: new Date('2026-03-08') }],
        [{ url: 'https://a.com', viewport: '1920x1080', performance: 75, accessibility: 75, bestPractices: 75, seo: 75 }],
        [{ url: 'https://a.com', viewport: '1920x1080', performance: 90, accessibility: 90, bestPractices: 90, seo: 90 }],
      ]);

      const result = await detectPerformanceRegressions(db as any, PROJ_ID, RUN_ID_CURRENT);
      // All 4 categories regressed below 80 threshold
      expect(result).toHaveLength(4);
      for (const r of result) {
        expect(r.threshold).toBe(80);
      }
    });

    it('ignores categories where score improved or stayed same', async () => {
      const db = buildMockDb([
        [{ id: RUN_ID_CURRENT, createdAt: new Date('2026-03-09') }],
        [{ id: RUN_ID_PREVIOUS, createdAt: new Date('2026-03-08') }],
        // Current: performance improved (95 > 90), a11y same (90), bestPractices dropped but above threshold (85), seo dropped below threshold
        [{ url: 'https://a.com', viewport: '1920x1080', performance: 95, accessibility: 90, bestPractices: 85, seo: 70 }],
        [{ url: 'https://a.com', viewport: '1920x1080', performance: 90, accessibility: 90, bestPractices: 90, seo: 90 }],
      ]);

      const result = await detectPerformanceRegressions(db as any, PROJ_ID, RUN_ID_CURRENT);
      // Only seo regressed (70 < 80 AND 70 < 90)
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('seo');
    });
  });

  // ---------- computeAveragePerfScore ----------
  describe('computeAveragePerfScore', () => {
    it('returns average performance score from latest run', async () => {
      const db = buildMockDb([
        // Query 0: latest run
        [{ id: RUN_ID_CURRENT }],
        // Query 1: scores for that run
        [
          { performance: 90 },
          { performance: 80 },
        ],
      ]);

      const result = await computeAveragePerfScore(db as any, PROJ_ID);
      expect(result).toBe(85); // (90+80)/2
    });

    it('returns -1 when no lighthouse data exists', async () => {
      const db = buildMockDb([
        // No runs
        [],
      ]);

      const result = await computeAveragePerfScore(db as any, PROJ_ID);
      expect(result).toBe(-1);
    });
  });

  // ---------- getRouteUrls ----------
  describe('getRouteUrls', () => {
    it('returns distinct URLs for a project', async () => {
      const db = buildMockDb([
        [{ url: 'https://a.com' }, { url: 'https://b.com' }],
      ]);

      const result = await getRouteUrls(db as any, PROJ_ID);
      expect(result).toHaveLength(2);
    });
  });

  // ---------- evaluateBudgets ----------
  describe('evaluateBudgets', () => {
    const baseScores = { performance: 85, accessibility: 90, bestPractices: 80, seo: 75 };

    it('returns passed=true when score is above budget', () => {
      const results = evaluateBudgets(
        baseScores,
        '/home',
        { performance: 80 },
      );
      const perfResult = results.find(r => r.category === 'performance');
      expect(perfResult).toBeDefined();
      expect(perfResult!.passed).toBe(true);
      expect(perfResult!.score).toBe(85);
      expect(perfResult!.budget).toBe(80);
    });

    it('returns passed=false when score is below budget', () => {
      const results = evaluateBudgets(
        { performance: 68, accessibility: 90, bestPractices: 80, seo: 75 },
        '/home',
        { performance: 75 },
      );
      const perfResult = results.find(r => r.category === 'performance');
      expect(perfResult).toBeDefined();
      expect(perfResult!.passed).toBe(false);
      expect(perfResult!.score).toBe(68);
      expect(perfResult!.budget).toBe(75);
    });

    it('route-specific budget overrides global threshold', () => {
      const results = evaluateBudgets(
        baseScores,
        '/dashboard',
        { performance: 80 },
        [{ route: '/dashboard', performance: 95 }],
      );
      const perfResult = results.find(r => r.category === 'performance');
      expect(perfResult).toBeDefined();
      // Route budget is 95, score is 85, so should fail
      expect(perfResult!.passed).toBe(false);
      expect(perfResult!.budget).toBe(95);
    });

    it('falls back to global threshold when no route-specific budget', () => {
      const results = evaluateBudgets(
        baseScores,
        '/home',
        { performance: 80, accessibility: 85 },
        [{ route: '/other', performance: 95 }],
      );
      const perfResult = results.find(r => r.category === 'performance');
      expect(perfResult).toBeDefined();
      expect(perfResult!.budget).toBe(80);
      expect(perfResult!.passed).toBe(true);
    });

    it('returns no check for categories without budget', () => {
      const results = evaluateBudgets(
        baseScores,
        '/home',
        { performance: 80 }, // only performance threshold
      );
      // Only performance should be checked
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('performance');
    });

    it('returns empty results when no budgets defined', () => {
      const results = evaluateBudgets(
        baseScores,
        '/home',
        {}, // no global thresholds
      );
      expect(results).toEqual([]);
    });
  });
});
