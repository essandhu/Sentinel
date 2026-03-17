import { describe, it, expect, vi, beforeEach } from 'vitest';

const PROJECT_ID = '00000000-0000-4000-a000-000000000501';
const WORKSPACE_ID = 'ws-analytics-test';

// ---------- Chainable mock DB ----------
function buildMockDb(selectResponses: unknown[][] = []) {
  let selectCallIdx = 0;

  const makeSelectChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.leftJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.groupBy = vi.fn(() => chain);
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
  approvalDecisions: {
    id: 'approvalDecisions.id',
    diffReportId: 'approvalDecisions.diffReportId',
    action: 'approvalDecisions.action',
    createdAt: 'approvalDecisions.createdAt',
    userEmail: 'approvalDecisions.userEmail',
  },
  diffReports: {
    id: 'diffReports.id',
    snapshotId: 'diffReports.snapshotId',
    pixelDiffPercent: 'diffReports.pixelDiffPercent',
    passed: 'diffReports.passed',
    createdAt: 'diffReports.createdAt',
  },
  snapshots: {
    id: 'snapshots.id',
    runId: 'snapshots.runId',
    url: 'snapshots.url',
    viewport: 'snapshots.viewport',
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
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  gte: vi.fn((...args: unknown[]) => ({ op: 'gte', args })),
  asc: vi.fn((...args: unknown[]) => ({ op: 'asc', args })),
  sql: vi.fn((...args: unknown[]) => ({ op: 'sql', args })),
  count: vi.fn((...args: unknown[]) => ({ op: 'count', args })),
  isNull: vi.fn((...args: unknown[]) => ({ op: 'isNull', args })),
}));

import { getTeamMetrics, getRegressionTrend, getDiffExportData } from './analytics-service.js';

describe('analytics-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTeamMetrics', () => {
    it('returns computed metrics when approvals exist', async () => {
      // Simulate rows: each row has approvalCreatedAt and diffCreatedAt
      // Approval 1: diff created at T+0, approved at T+3600000ms (1 hour)
      // Approval 2: diff created at T+0, approved at T+7200000ms (2 hours)
      // Mean = 1.5 hours = 5400000ms, velocity = 2/30 = 0.0667, total = 2
      const now = new Date('2026-03-10T12:00:00Z');
      const rows = [
        {
          approvalCreatedAt: new Date('2026-03-10T11:00:00Z'),
          diffCreatedAt: new Date('2026-03-10T10:00:00Z'),
        },
        {
          approvalCreatedAt: new Date('2026-03-10T11:00:00Z'),
          diffCreatedAt: new Date('2026-03-10T09:00:00Z'),
        },
      ];
      const db = buildMockDb([rows]);

      const result = await getTeamMetrics(db as any, PROJECT_ID, 30, WORKSPACE_ID);

      expect(result.totalApprovals).toBe(2);
      // First: 1h = 3600000ms, Second: 2h = 7200000ms, mean = 5400000ms
      expect(result.meanTimeToApproveMs).toBe(5400000);
      expect(result.approvalVelocity).toBeCloseTo(2 / 30, 4);
    });

    it('returns null/0 when no approvals in window', async () => {
      const db = buildMockDb([[]]);

      const result = await getTeamMetrics(db as any, PROJECT_ID, 30, WORKSPACE_ID);

      expect(result.totalApprovals).toBe(0);
      expect(result.meanTimeToApproveMs).toBeNull();
      expect(result.approvalVelocity).toBe(0);
    });
  });

  describe('getRegressionTrend', () => {
    it('returns daily regression counts sorted by date', async () => {
      const rows = [
        { date: '2026-03-08', count: 3 },
        { date: '2026-03-09', count: 1 },
        { date: '2026-03-10', count: 5 },
      ];
      const db = buildMockDb([rows]);

      const result = await getRegressionTrend(db as any, PROJECT_ID, 30, WORKSPACE_ID);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ date: '2026-03-08', count: 3 });
      expect(result[1]).toEqual({ date: '2026-03-09', count: 1 });
      expect(result[2]).toEqual({ date: '2026-03-10', count: 5 });
    });

    it('returns empty array when no regressions', async () => {
      const db = buildMockDb([[]]);

      const result = await getRegressionTrend(db as any, PROJECT_ID, 30, WORKSPACE_ID);

      expect(result).toEqual([]);
    });
  });

  describe('getDiffExportData', () => {
    it('returns flat diff + approval rows', async () => {
      const rows = [
        {
          url: 'https://example.com',
          viewport: '1920x1080',
          pixelDiffPercent: 250, // basis points = 2.50%
          passed: 'false',
          diffCreatedAt: new Date('2026-03-10T10:00:00Z'),
          approvalAction: 'approved',
          approvalDate: new Date('2026-03-10T11:00:00Z'),
          approverEmail: 'alice@test.com',
        },
      ];
      const db = buildMockDb([rows]);

      const result = await getDiffExportData(db as any, PROJECT_ID, 30, WORKSPACE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com');
      expect(result[0].pixelDiffPercent).toBe(2.5);
      expect(result[0].approvalAction).toBe('approved');
      expect(result[0].approverEmail).toBe('alice@test.com');
    });

    it('handles diffs without approvals (null approval fields)', async () => {
      const rows = [
        {
          url: 'https://example.com/page',
          viewport: '1280x720',
          pixelDiffPercent: null,
          passed: 'pending',
          diffCreatedAt: new Date('2026-03-10T09:00:00Z'),
          approvalAction: null,
          approvalDate: null,
          approverEmail: null,
        },
      ];
      const db = buildMockDb([rows]);

      const result = await getDiffExportData(db as any, PROJECT_ID, 30, WORKSPACE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].pixelDiffPercent).toBeNull();
      expect(result[0].approvalAction).toBeNull();
      expect(result[0].approverEmail).toBeNull();
    });

    it('returns empty array when no diffs', async () => {
      const db = buildMockDb([[]]);

      const result = await getDiffExportData(db as any, PROJECT_ID, 30, WORKSPACE_ID);

      expect(result).toEqual([]);
    });
  });
});
