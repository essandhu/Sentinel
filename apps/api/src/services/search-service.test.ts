import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Test UUIDs ----------
const PROJ_ID = '00000000-0000-4000-a000-000000000001';
const WS_ID = 'ws_test_workspace';

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
  createDb: vi.fn(() => ({})),
  snapshots: {
    id: 'snapshots.id',
    runId: 'snapshots.runId',
    url: 'snapshots.url',
    viewport: 'snapshots.viewport',
    componentId: 'snapshots.componentId',
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.projectId',
  },
  projects: {
    id: 'projects.id',
    workspaceId: 'projects.workspaceId',
  },
  components: {
    id: 'components.id',
    projectId: 'components.projectId',
    name: 'components.name',
  },
  diffReports: {
    id: 'diffReports.id',
    snapshotId: 'diffReports.snapshotId',
    pixelDiffPercent: 'diffReports.pixelDiffPercent',
    passed: 'diffReports.passed',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  ilike: vi.fn((col, pattern) => ({ _type: 'ilike', col, pattern })),
}));

import { globalSearch } from './search-service.js';

describe('globalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty results when query is less than 2 characters', async () => {
    const db = buildMockDb([]);
    const result = await globalSearch(db as any, PROJ_ID, 'a', WS_ID);

    expect(result).toEqual({ routes: [], components: [], diffs: [] });
    // Should not even query the database
    expect(db.selectDistinct).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns empty results when query is empty string', async () => {
    const db = buildMockDb([]);
    const result = await globalSearch(db as any, PROJ_ID, '', WS_ID);

    expect(result).toEqual({ routes: [], components: [], diffs: [] });
  });

  it('returns matching routes, components, and diffs', async () => {
    const db = buildMockDb([
      // Query 0: routes (selectDistinct)
      [
        { url: '/login', runId: 'run-1' },
        { url: '/login/reset', runId: 'run-2' },
      ],
      // Query 1: components (select)
      [
        { id: 'comp-1', name: 'LoginForm' },
      ],
      // Query 2: diffs (select)
      [
        { id: 'diff-1', url: '/login', pixelDiffPercent: 250 },
      ],
    ]);

    const result = await globalSearch(db as any, PROJ_ID, 'login', WS_ID);

    expect(result.routes).toHaveLength(2);
    expect(result.routes[0]).toEqual({ url: '/login', runId: 'run-1' });
    expect(result.components).toHaveLength(1);
    expect(result.components[0]).toEqual({ id: 'comp-1', name: 'LoginForm' });
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]).toEqual({ id: 'diff-1', url: '/login', pixelDiffPercent: 250 });
  });

  it('runs 3 queries in parallel via Promise.all', async () => {
    const db = buildMockDb([[], [], []]);

    await globalSearch(db as any, PROJ_ID, 'test', WS_ID);

    // selectDistinct for routes + select for components + select for diffs
    expect(db.selectDistinct).toHaveBeenCalledTimes(1);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('uses ILIKE pattern with wildcards', async () => {
    const { ilike } = await import('drizzle-orm');
    const db = buildMockDb([[], [], []]);

    await globalSearch(db as any, PROJ_ID, 'test', WS_ID);

    // ilike should be called with %test% pattern
    expect(ilike).toHaveBeenCalledWith(expect.anything(), '%test%');
  });
});
