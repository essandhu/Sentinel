import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Test UUIDs ----------
const RUN_ID = '00000000-0000-4000-a000-000000000100';
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
  diffReports: {
    id: 'diffReports.id',
    snapshotId: 'diffReports.snapshotId',
    baselineS3Key: 'diffReports.baselineS3Key',
    diffS3Key: 'diffReports.diffS3Key',
    pixelDiffPercent: 'diffReports.pixelDiffPercent',
    ssimScore: 'diffReports.ssimScore',
    passed: 'diffReports.passed',
    createdAt: 'diffReports.createdAt',
  },
  snapshots: {
    id: 'snapshots.id',
    runId: 'snapshots.runId',
    s3Key: 'snapshots.s3Key',
    url: 'snapshots.url',
    viewport: 'snapshots.viewport',
    browser: 'snapshots.browser',
    breakpointName: 'snapshots.breakpointName',
    parameterName: 'snapshots.parameterName',
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.projectId',
  },
  projects: {
    id: 'projects.id',
    workspaceId: 'projects.workspaceId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
}));

import { getDiffsByRunId, verifyRunInWorkspace } from './diff-service.js';

describe('diff-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDiffsByRunId', () => {
    it('returns diff reports joined with snapshot fields', async () => {
      const diffs = [
        {
          id: 'diff-1',
          snapshotId: 'snap-1',
          snapshotS3Key: 'key1',
          url: '/home',
          viewport: '1920x1080',
          browser: 'chromium',
          baselineS3Key: 'baseline1',
          diffS3Key: 'diff1',
          pixelDiffPercent: 150,
          ssimScore: 0.95,
          passed: 'true',
          createdAt: '2026-01-01',
          breakpointName: 'desktop',
          parameterName: null,
        },
      ];
      const db = buildMockDb([diffs]);
      const result = await getDiffsByRunId(db as any, RUN_ID);

      expect(result).toEqual(diffs);
      expect(db.select).toHaveBeenCalled();
    });

    it('adds workspace filter when workspaceId is provided', async () => {
      const { eq, and } = await import('drizzle-orm');
      const db = buildMockDb([[]]);
      await getDiffsByRunId(db as any, RUN_ID, WS_ID);

      // and() should be called with runId eq AND workspaceId eq
      expect(and).toHaveBeenCalled();
      const andCall = (and as any).mock.calls[0];
      // Should have 2 conditions: runId filter + workspaceId filter
      expect(andCall.length).toBe(2);
      expect(eq).toHaveBeenCalledWith('projects.workspaceId', WS_ID);
    });

    it('omits workspace filter when workspaceId is not provided', async () => {
      const { eq, and } = await import('drizzle-orm');
      const db = buildMockDb([[]]);
      await getDiffsByRunId(db as any, RUN_ID);

      // and() should be called with only the runId condition
      expect(and).toHaveBeenCalled();
      const andCall = (and as any).mock.calls[0];
      expect(andCall.length).toBe(1);
      // eq should NOT be called with workspaceId
      const eqCalls = (eq as any).mock.calls;
      const wsCall = eqCalls.find(
        (c: any) => c[0] === 'projects.workspaceId' && c[1] === WS_ID,
      );
      expect(wsCall).toBeUndefined();
    });
  });

  describe('verifyRunInWorkspace', () => {
    it('returns run row when found', async () => {
      const row = { id: RUN_ID, projectId: 'proj-1' };
      const db = buildMockDb([[row]]);
      const result = await verifyRunInWorkspace(db as any, RUN_ID, WS_ID);

      expect(result).toEqual(row);
      expect(db.select).toHaveBeenCalled();
    });

    it('returns null when not found', async () => {
      const db = buildMockDb([[]]);
      const result = await verifyRunInWorkspace(db as any, RUN_ID, WS_ID);

      expect(result).toBeNull();
    });
  });
});
