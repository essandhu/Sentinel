import { describe, it, expect, vi, beforeEach } from 'vitest';

const PROJECT_ID = '00000000-0000-4000-a000-000000000400';

// ---------- Chainable mock DB ----------
function buildMockDb(selectResponses: unknown[][] = []) {
  let selectCallIdx = 0;

  const makeSelectChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
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

vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => ({})),
  diffReports: {
    id: 'diffReports.id',
    snapshotId: 'diffReports.snapshotId',
    passed: 'diffReports.passed',
    createdAt: 'diffReports.createdAt',
  },
  snapshots: {
    id: 'snapshots.id',
    runId: 'snapshots.runId',
    url: 'snapshots.url',
    viewport: 'snapshots.viewport',
    browser: 'snapshots.browser',
    parameterName: 'snapshots.parameterName',
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.projectId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  gte: vi.fn((...args: unknown[]) => ({ op: 'gte', args })),
  asc: vi.fn((...args: unknown[]) => ({ op: 'asc', args })),
  desc: vi.fn((...args: unknown[]) => ({ op: 'desc', args })),
}));

import { listHandler, flipHistoryHandler } from './stability.js';

describe('stabilityRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('returns stability scores for a project', async () => {
      const diffRows = [
        { url: '/', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'true', createdAt: new Date('2026-03-01') },
        { url: '/', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-03-02') },
        { url: '/', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'true', createdAt: new Date('2026-03-03') },
      ];
      const db = buildMockDb([diffRows]);

      const result = await listHandler(db as any, PROJECT_ID);
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('/');
      expect(result[0].flipCount).toBe(2);
      expect(result[0].stabilityScore).toBe(80); // 100 - 2*10
    });

    it('returns empty array when no diff data', async () => {
      const db = buildMockDb([[]]);
      const result = await listHandler(db as any, PROJECT_ID);
      expect(result).toEqual([]);
    });
  });

  describe('flipHistory', () => {
    it('returns diff results ordered by time for a route', async () => {
      const historyRows = [
        { passed: 'true', createdAt: new Date('2026-03-01') },
        { passed: 'false', createdAt: new Date('2026-03-02') },
      ];
      const db = buildMockDb([historyRows]);

      const result = await flipHistoryHandler(db as any, PROJECT_ID, '/', '1280x720', 'chromium', '');
      expect(result).toHaveLength(2);
      expect(result[0].passed).toBe('true');
      expect(result[1].passed).toBe('false');
    });
  });
});
