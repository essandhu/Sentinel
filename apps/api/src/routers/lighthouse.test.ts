import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Test UUIDs ----------
const PROJECT_ID = '00000000-0000-4000-a000-000000000800';
const CAPTURE_RUN_ID = '00000000-0000-4000-a000-000000000801';

// ---------- Mock service functions ----------
const mockGetLighthouseScores = vi.fn();
const mockGetLighthouseTrend = vi.fn();
const mockDetectPerformanceRegressions = vi.fn();
const mockGetRouteUrls = vi.fn();
const mockGetBudgets = vi.fn();
const mockUpsertBudgets = vi.fn();
const mockEvaluateBudgets = vi.fn();

vi.mock('../services/lighthouse-query-service.js', () => ({
  getLighthouseScores: (...args: unknown[]) => mockGetLighthouseScores(...args),
  getLighthouseTrend: (...args: unknown[]) => mockGetLighthouseTrend(...args),
  detectPerformanceRegressions: (...args: unknown[]) => mockDetectPerformanceRegressions(...args),
  getRouteUrls: (...args: unknown[]) => mockGetRouteUrls(...args),
  getBudgets: (...args: unknown[]) => mockGetBudgets(...args),
  upsertBudgets: (...args: unknown[]) => mockUpsertBudgets(...args),
  evaluateBudgets: (...args: unknown[]) => mockEvaluateBudgets(...args),
}));

// Mock @sentinel/db
vi.mock('@sentinel/db', () => ({
  createDb: vi.fn(() => ({})),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  desc: vi.fn((col) => ({ _type: 'desc', col })),
}));

// Import router AFTER mocks
import { lighthouseRouter } from './lighthouse.js';
import { t } from '../trpc.js';

const createCaller = t.createCallerFactory(lighthouseRouter);

describe('lighthouseRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scores', () => {
    it('calls getLighthouseScores with correct captureRunId', async () => {
      const scores = [{ url: '/', performance: 95, accessibility: 100, bestPractices: 90, seo: 85 }];
      mockGetLighthouseScores.mockResolvedValue(scores);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.scores({ captureRunId: CAPTURE_RUN_ID });

      expect(result).toEqual(scores);
      expect(mockGetLighthouseScores).toHaveBeenCalledWith(
        expect.anything(), // db
        CAPTURE_RUN_ID,
      );
    });
  });

  describe('trend', () => {
    it('calls getLighthouseTrend with correct args', async () => {
      const trendData = [{ runId: CAPTURE_RUN_ID, performance: 92, createdAt: new Date() }];
      mockGetLighthouseTrend.mockResolvedValue(trendData);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.trend({
        projectId: PROJECT_ID,
        url: '/dashboard',
        limit: 10,
      });

      expect(result).toEqual(trendData);
      expect(mockGetLighthouseTrend).toHaveBeenCalledWith(
        expect.anything(), // db
        PROJECT_ID,
        '/dashboard',
        { limit: 10 },
      );
    });
  });

  describe('regressions', () => {
    it('calls detectPerformanceRegressions with correct args', async () => {
      const regressions = [{ url: '/', category: 'performance', drop: 15 }];
      mockDetectPerformanceRegressions.mockResolvedValue(regressions);

      const thresholds = { performance: 5 };
      const caller = createCaller({ auth: null } as any);
      const result = await caller.regressions({
        projectId: PROJECT_ID,
        captureRunId: CAPTURE_RUN_ID,
        thresholds,
      });

      expect(result).toEqual(regressions);
      expect(mockDetectPerformanceRegressions).toHaveBeenCalledWith(
        expect.anything(), // db
        PROJECT_ID,
        CAPTURE_RUN_ID,
        thresholds,
      );
    });
  });

  describe('routeUrls', () => {
    it('calls getRouteUrls with correct projectId', async () => {
      const urls = ['/', '/about', '/contact'];
      mockGetRouteUrls.mockResolvedValue(urls);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.routeUrls({ projectId: PROJECT_ID });

      expect(result).toEqual(urls);
      expect(mockGetRouteUrls).toHaveBeenCalledWith(
        expect.anything(), // db
        PROJECT_ID,
      );
    });
  });

  describe('budgetsList', () => {
    it('calls getBudgets with correct projectId', async () => {
      const budgets = [{ route: '/', performance: 90, accessibility: 95, bestPractices: null, seo: null }];
      mockGetBudgets.mockResolvedValue(budgets);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.budgetsList({ projectId: PROJECT_ID });

      expect(result).toEqual(budgets);
      expect(mockGetBudgets).toHaveBeenCalledWith(
        expect.anything(), // db
        PROJECT_ID,
      );
    });
  });

  describe('budgetsUpsert', () => {
    it('calls upsertBudgets with correct args', async () => {
      const budgetsInput = [{ route: '/', performance: 90 }];
      const upsertResult = [{ id: 'b1', route: '/', performance: 90 }];
      mockUpsertBudgets.mockResolvedValue(upsertResult);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.budgetsUpsert({
        projectId: PROJECT_ID,
        budgets: budgetsInput,
      });

      expect(result).toEqual(upsertResult);
      expect(mockUpsertBudgets).toHaveBeenCalledWith(
        expect.anything(), // db
        PROJECT_ID,
        budgetsInput,
      );
    });
  });

  describe('budgetsEvaluate', () => {
    it('returns pass when all budget checks pass', async () => {
      const scores = [
        { url: '/', performance: 95, accessibility: 100, bestPractices: 90, seo: 85 },
      ];
      const budgets = [
        { route: '/', performance: 90, accessibility: 90, bestPractices: null, seo: null },
      ];
      mockGetLighthouseScores.mockResolvedValue(scores);
      mockGetBudgets.mockResolvedValue(budgets);
      mockEvaluateBudgets.mockReturnValue([
        { route: '/', category: 'performance', actual: 95, budget: 90, passed: true },
        { route: '/', category: 'accessibility', actual: 100, budget: 90, passed: true },
      ]);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.budgetsEvaluate({
        projectId: PROJECT_ID,
        captureRunId: CAPTURE_RUN_ID,
      });

      expect(result.passed).toBe(true);
      expect(result.totalChecks).toBe(2);
      expect(result.failedChecks).toBe(0);
      expect(mockGetLighthouseScores).toHaveBeenCalledWith(expect.anything(), CAPTURE_RUN_ID);
      expect(mockGetBudgets).toHaveBeenCalledWith(expect.anything(), PROJECT_ID);
    });

    it('returns fail when budget checks fail', async () => {
      const scores = [
        { url: '/', performance: 60, accessibility: 100, bestPractices: 90, seo: 85 },
      ];
      const budgets = [
        { route: '/', performance: 90, accessibility: null, bestPractices: null, seo: null },
      ];
      mockGetLighthouseScores.mockResolvedValue(scores);
      mockGetBudgets.mockResolvedValue(budgets);
      mockEvaluateBudgets.mockReturnValue([
        { route: '/', category: 'performance', actual: 60, budget: 90, passed: false },
      ]);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.budgetsEvaluate({
        projectId: PROJECT_ID,
        captureRunId: CAPTURE_RUN_ID,
      });

      expect(result.passed).toBe(false);
      expect(result.failedChecks).toBe(1);
    });
  });
});
