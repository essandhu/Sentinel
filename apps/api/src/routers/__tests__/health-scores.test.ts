import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test UUIDs
const PROJ_ID = '00000000-0000-4000-a000-000000000001';
const COMP_ID_A = '00000000-0000-4000-a000-000000000010';
const COMP_ID_B = '00000000-0000-4000-a000-000000000011';

// vi.hoisted ensures the mock state is available at mock factory time (before imports)
const { mockDbState } = vi.hoisted(() => {
  const mockDbState = { current: null as any };
  return { mockDbState };
});

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
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(fn);
    return chain;
  };

  const db = {
    select: vi.fn((..._args: unknown[]) => {
      const response = selectResponses[selectCallIdx] ?? [];
      selectCallIdx++;
      return makeSelectChain(response);
    }),
    insert: vi.fn(() => {
      const chain: Record<string, any> = {};
      chain.values = vi.fn(() => chain);
      chain.returning = vi.fn();
      chain.then = (fn: (v: unknown) => unknown) =>
        Promise.resolve(undefined).then(fn);
      return chain;
    }),
    delete: vi.fn(() => {
      const chain: Record<string, any> = {};
      chain.where = vi.fn(() => chain);
      chain.then = (fn: (v: unknown) => unknown) =>
        Promise.resolve(undefined).then(fn);
      return chain;
    }),
  };

  return db;
}

vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => mockDbState.current),
  projects: { id: 'projects.id', workspaceId: 'projects.workspaceId' },
  healthScores: {
    id: 'healthScores.id',
    projectId: 'healthScores.projectId',
    componentId: 'healthScores.componentId',
    score: 'healthScores.score',
    windowDays: 'healthScores.windowDays',
    computedAt: 'healthScores.computedAt',
  },
  components: {
    id: 'components.id',
    name: 'components.name',
  },
}));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  asc: vi.fn((col) => ({ _type: 'asc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  gte: vi.fn((a, b) => ({ _type: 'gte', a, b })),
  isNull: vi.fn((a) => ({ _type: 'isNull', a })),
  isNotNull: vi.fn((a) => ({ _type: 'isNotNull', a })),
  ne: vi.fn((a, b) => ({ _type: 'ne', a, b })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
    { raw: vi.fn((s: string) => ({ _type: 'sql_raw', s })) },
  ),
}));

vi.mock('../../trpc.js', async () => {
  const { initTRPC } = await import('@trpc/server');
  const t = initTRPC.create();
  return {
    t,
    workspaceProcedure: t.procedure,
  };
});

import { healthScoresRouter } from '../health-scores.js';
import { initTRPC } from '@trpc/server';

const t = initTRPC.create();
const router = t.router({ healthScores: healthScoresRouter });
const caller = router.createCaller({});

describe('healthScores router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('healthScores.projectScore', () => {
    it('returns latest pre-computed project score with workspace isolation', async () => {
      const now = new Date();
      mockDbState.current = buildMockDb([
        [{ score: 92, computedAt: now }],
      ]);

      const result = await caller.healthScores.projectScore({ projectId: PROJ_ID });

      expect(result).toEqual({ score: 92, computedAt: now });
    });

    it('returns null when no scores exist', async () => {
      mockDbState.current = buildMockDb([
        [],
      ]);

      const result = await caller.healthScores.projectScore({ projectId: PROJ_ID });

      expect(result).toBeNull();
    });
  });

  describe('healthScores.componentScores', () => {
    it('returns component scores sorted worst-first (ascending by score, excluding -1)', async () => {
      const now = new Date();
      mockDbState.current = buildMockDb([
        [
          { componentId: COMP_ID_A, componentName: 'Header', score: 72, computedAt: now },
          { componentId: COMP_ID_B, componentName: 'Footer', score: 95, computedAt: now },
        ],
      ]);

      const result = await caller.healthScores.componentScores({ projectId: PROJ_ID });

      expect(result).toHaveLength(2);
      // Should be sorted worst-first (ascending)
      expect(result[0].score).toBeLessThanOrEqual(result[1].score);
    });

    it('deduplicates multiple historical rows per componentId, keeping latest', async () => {
      const older = new Date('2026-02-01');
      const newer = new Date('2026-02-15');
      mockDbState.current = buildMockDb([
        [
          // Two entries for COMP_ID_A (older and newer)
          { componentId: COMP_ID_A, componentName: 'Header', score: 72, computedAt: older },
          { componentId: COMP_ID_A, componentName: 'Header', score: 85, computedAt: newer },
          // One entry for COMP_ID_B
          { componentId: COMP_ID_B, componentName: 'Footer', score: 95, computedAt: newer },
        ],
      ]);

      const result = await caller.healthScores.componentScores({ projectId: PROJ_ID });

      // Should deduplicate: one entry per componentId
      expect(result).toHaveLength(2);
      // Should keep latest (newer) entry for COMP_ID_A
      const headerScore = result.find((r: any) => r.componentId === COMP_ID_A);
      expect(headerScore?.score).toBe(85);
      expect(headerScore?.computedAt).toEqual(newer);
      // Results should be sorted by score ascending (worst-first)
      expect(result[0].score).toBeLessThanOrEqual(result[1].score);
    });

    it('returns empty array when no component scores exist', async () => {
      mockDbState.current = buildMockDb([
        [],
      ]);

      const result = await caller.healthScores.componentScores({ projectId: PROJ_ID });

      expect(result).toEqual([]);
    });
  });

  describe('healthScores.trend', () => {
    it('returns historical score rows for trend chart', async () => {
      const date1 = new Date('2026-02-01');
      const date2 = new Date('2026-02-15');
      mockDbState.current = buildMockDb([
        [
          { score: 85, computedAt: date1 },
          { score: 90, computedAt: date2 },
        ],
      ]);

      const result = await caller.healthScores.trend({
        projectId: PROJ_ID,
        windowDays: '30',
      });

      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(85);
      expect(result[1].score).toBe(90);
    });

    it('supports optional componentId filter', async () => {
      mockDbState.current = buildMockDb([
        [{ score: 78, computedAt: new Date() }],
      ]);

      const result = await caller.healthScores.trend({
        projectId: PROJ_ID,
        windowDays: '30',
        componentId: COMP_ID_A,
      });

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(78);
    });

    it('returns empty array when no trend data exists', async () => {
      mockDbState.current = buildMockDb([
        [],
      ]);

      const result = await caller.healthScores.trend({
        projectId: PROJ_ID,
        windowDays: '7',
      });

      expect(result).toEqual([]);
    });
  });
});
