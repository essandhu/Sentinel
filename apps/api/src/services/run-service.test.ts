import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Test UUIDs ----------
const RUN_ID = '00000000-0000-4000-a000-000000000200';
const PROJ_ID = '00000000-0000-4000-a000-000000000201';
const WS_ID = 'ws_test_workspace';

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
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.projectId',
    branchName: 'captureRuns.branchName',
    commitSha: 'captureRuns.commitSha',
    status: 'captureRuns.status',
    createdAt: 'captureRuns.createdAt',
    completedAt: 'captureRuns.completedAt',
    suiteName: 'captureRuns.suiteName',
    source: 'captureRuns.source',
  },
  snapshots: {
    id: 'snapshots.id',
    runId: 'snapshots.runId',
  },
  diffReports: {
    id: 'diffReports.id',
    snapshotId: 'diffReports.snapshotId',
  },
  projects: {
    id: 'projects.id',
    workspaceId: 'projects.workspaceId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  count: vi.fn((col) => ({ _type: 'count', col })),
  inArray: vi.fn((col, vals) => ({ _type: 'inArray', col, vals })),
}));

import { listRuns, getRunById, listRunsByProject } from './run-service.js';

describe('run-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listRuns', () => {
    it('returns runs with totalDiffs count', async () => {
      const runs = [
        {
          id: RUN_ID,
          projectId: PROJ_ID,
          branchName: 'main',
          commitSha: 'abc123',
          status: 'completed',
          createdAt: '2026-01-01',
          completedAt: '2026-01-01',
          suiteName: 'default',
          totalDiffs: 5,
        },
      ];
      const db = buildMockDb([runs]);
      const result = await listRuns(db as any);

      expect(result).toEqual(runs);
      expect(db.select).toHaveBeenCalled();
    });

    it('filters by projectId when provided', async () => {
      const { eq } = await import('drizzle-orm');
      const db = buildMockDb([[]]);
      await listRuns(db as any, { projectId: PROJ_ID });

      expect(eq).toHaveBeenCalledWith('captureRuns.projectId', PROJ_ID);
    });

    it('filters by workspaceId when provided', async () => {
      const { eq } = await import('drizzle-orm');
      const db = buildMockDb([[]]);
      await listRuns(db as any, { workspaceId: WS_ID });

      expect(eq).toHaveBeenCalledWith('projects.workspaceId', WS_ID);
    });

    it('uses default limit of 50', async () => {
      const db = buildMockDb([[]]);
      await listRuns(db as any);

      const selectChain = (db.select as any).mock.results[0].value;
      expect(selectChain.limit).toHaveBeenCalledWith(50);
    });
  });

  describe('getRunById', () => {
    it('returns run when found', async () => {
      const run = {
        id: RUN_ID,
        projectId: PROJ_ID,
        branchName: 'main',
        commitSha: 'abc123',
        status: 'completed',
        createdAt: '2026-01-01',
        completedAt: '2026-01-01',
        suiteName: 'default',
        totalDiffs: 3,
      };
      const db = buildMockDb([[run]]);
      const result = await getRunById(db as any, RUN_ID);

      expect(result).toEqual(run);
    });

    it('returns null when not found', async () => {
      const db = buildMockDb([[]]);
      const result = await getRunById(db as any, RUN_ID);

      expect(result).toBeNull();
    });

    it('filters by workspaceId when provided', async () => {
      const { eq } = await import('drizzle-orm');
      const db = buildMockDb([[]]);
      await getRunById(db as any, RUN_ID, WS_ID);

      expect(eq).toHaveBeenCalledWith('projects.workspaceId', WS_ID);
    });
  });

  describe('listRunsByProject', () => {
    it('returns runs for project', async () => {
      const runs = [
        {
          id: RUN_ID,
          commitSha: 'abc123',
          branchName: 'main',
          status: 'completed',
          source: 'api',
          createdAt: '2026-01-01',
          completedAt: '2026-01-01',
        },
      ];
      const db = buildMockDb([runs]);
      const result = await listRunsByProject(db as any, PROJ_ID);

      expect(result).toEqual(runs);
      expect(db.select).toHaveBeenCalled();
    });
  });
});
