import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Test UUIDs ----------
const PROJ_ID = '00000000-0000-4000-a000-000000000400';
const WS_ID = 'ws_test_workspace';
const COMP_ID = '00000000-0000-4000-a000-000000000401';

// ---------- Chainable mock DB ----------
function buildMockDb(selectResponses: unknown[][] = []) {
  let selectCallIdx = 0;

  const makeSelectChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.leftJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.groupBy = vi.fn(() => chain);
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(fn);
    return chain;
  };

  return {
    select: vi.fn((..._args: unknown[]) => {
      const response = selectResponses[selectCallIdx] ?? [];
      selectCallIdx++;
      return makeSelectChain(response);
    }),
  };
}

// Mock @sentinel-vrt/db
vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => ({})),
  healthScores: {
    id: 'healthScores.id',
    projectId: 'healthScores.projectId',
    componentId: 'healthScores.componentId',
    score: 'healthScores.score',
    windowDays: 'healthScores.windowDays',
    computedAt: 'healthScores.computedAt',
  },
  projects: {
    id: 'projects.id',
    workspaceId: 'projects.workspaceId',
  },
  components: {
    id: 'components.id',
    name: 'components.name',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  gte: vi.fn((a, b) => ({ _type: 'gte', a, b })),
  isNull: vi.fn((col) => ({ _type: 'isNull', col })),
  isNotNull: vi.fn((col) => ({ _type: 'isNotNull', col })),
  ne: vi.fn((a, b) => ({ _type: 'ne', a, b })),
}));

import {
  getProjectHealthScore,
  getComponentScores,
  getHealthTrend,
  listHealthScores,
} from './health-query-service.js';

describe('health-query-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjectHealthScore', () => {
    it('returns latest score', async () => {
      const scoreRow = { score: 85, computedAt: '2026-01-01T00:00:00Z' };
      const db = buildMockDb([[scoreRow]]);
      const result = await getProjectHealthScore(db as any, PROJ_ID);

      expect(result).toEqual(scoreRow);
      expect(db.select).toHaveBeenCalled();
    });

    it('returns null when no scores', async () => {
      const db = buildMockDb([[]]);
      const result = await getProjectHealthScore(db as any, PROJ_ID);

      expect(result).toBeNull();
    });

    it('filters by workspaceId when provided', async () => {
      const { eq } = await import('drizzle-orm');
      const db = buildMockDb([[]]);
      await getProjectHealthScore(db as any, PROJ_ID, WS_ID);

      expect(eq).toHaveBeenCalledWith('projects.workspaceId', WS_ID);
    });
  });

  describe('getComponentScores', () => {
    it('returns deduplicated scores sorted worst-first', async () => {
      const rows = [
        { componentId: 'comp-a', componentName: 'Header', score: 90, computedAt: '2026-01-02T00:00:00Z' },
        { componentId: 'comp-a', componentName: 'Header', score: 80, computedAt: '2026-01-01T00:00:00Z' },
        { componentId: 'comp-b', componentName: 'Footer', score: 60, computedAt: '2026-01-02T00:00:00Z' },
      ];
      const db = buildMockDb([rows]);
      const result = await getComponentScores(db as any, PROJ_ID);

      // Should deduplicate comp-a (keep latest = score 90), sort worst-first
      expect(result).toHaveLength(2);
      expect(result[0].componentId).toBe('comp-b'); // score 60 first (worst)
      expect(result[1].componentId).toBe('comp-a'); // score 90 second
    });

    it('excludes score=-1 entries via ne condition', async () => {
      const { ne } = await import('drizzle-orm');
      const db = buildMockDb([[]]);
      await getComponentScores(db as any, PROJ_ID);

      expect(ne).toHaveBeenCalledWith('healthScores.score', -1);
    });
  });

  describe('getHealthTrend', () => {
    it('returns scores within window', async () => {
      const trendData = [
        { score: 75, computedAt: '2026-01-01T00:00:00Z' },
        { score: 80, computedAt: '2026-01-02T00:00:00Z' },
        { score: 85, computedAt: '2026-01-03T00:00:00Z' },
      ];
      const db = buildMockDb([trendData]);
      const result = await getHealthTrend(db as any, PROJ_ID);

      expect(result).toEqual(trendData);
      expect(db.select).toHaveBeenCalled();
    });

    it('filters by componentId when provided', async () => {
      const { eq } = await import('drizzle-orm');
      const db = buildMockDb([[]]);
      await getHealthTrend(db as any, PROJ_ID, { componentId: COMP_ID });

      expect(eq).toHaveBeenCalledWith('healthScores.componentId', COMP_ID);
    });
  });

  describe('listHealthScores', () => {
    it('returns all scores for project', async () => {
      const scores = [
        { id: 'hs-1', componentId: null, score: 85, windowDays: 30, computedAt: '2026-01-01' },
        { id: 'hs-2', componentId: COMP_ID, score: 70, windowDays: 30, computedAt: '2026-01-01' },
      ];
      const db = buildMockDb([scores]);
      const result = await listHealthScores(db as any, PROJ_ID);

      expect(result).toEqual(scores);
      expect(db.select).toHaveBeenCalled();
    });
  });
});
