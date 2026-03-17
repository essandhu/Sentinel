import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ---------- Chainable mock DB ----------
function buildMockDb(selectResponses: unknown[][] = []) {
  let selectCallIdx = 0;

  const makeSelectChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
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
  createDb: vi.fn(() => buildMockDb()),
  approvalDecisions: { id: 'approvalDecisions.id', diffReportId: 'approvalDecisions.diffReportId', action: 'approvalDecisions.action', createdAt: 'approvalDecisions.createdAt' },
  diffReports: { id: 'diffReports.id', snapshotId: 'diffReports.snapshotId', passed: 'diffReports.passed', createdAt: 'diffReports.createdAt' },
  snapshots: { id: 'snapshots.id', runId: 'snapshots.runId' },
  captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId' },
  projects: { id: 'projects.id', workspaceId: 'projects.workspaceId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  gte: vi.fn((...args: unknown[]) => ({ op: 'gte', args })),
  asc: vi.fn((...args: unknown[]) => ({ op: 'asc', args })),
  sql: vi.fn((...args: unknown[]) => ({ op: 'sql', args })),
  count: vi.fn((...args: unknown[]) => ({ op: 'count', args })),
}));

describe('analytics router input validation', () => {
  const teamMetricsSchema = z.object({
    projectId: z.string().uuid(),
    windowDays: z.enum(['30', '60', '90']).default('30'),
  });

  it('accepts valid projectId and default windowDays', () => {
    const result = teamMetricsSchema.parse({
      projectId: '00000000-0000-4000-a000-000000000501',
    });
    expect(result.windowDays).toBe('30');
  });

  it('accepts valid projectId with explicit windowDays', () => {
    const result = teamMetricsSchema.parse({
      projectId: '00000000-0000-4000-a000-000000000501',
      windowDays: '60',
    });
    expect(result.windowDays).toBe('60');
  });

  it('rejects non-UUID projectId', () => {
    expect(() =>
      teamMetricsSchema.parse({ projectId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('rejects invalid windowDays value', () => {
    expect(() =>
      teamMetricsSchema.parse({
        projectId: '00000000-0000-4000-a000-000000000501',
        windowDays: '7',
      }),
    ).toThrow();
  });

  it('accepts 90-day window', () => {
    const result = teamMetricsSchema.parse({
      projectId: '00000000-0000-4000-a000-000000000501',
      windowDays: '90',
    });
    expect(result.windowDays).toBe('90');
  });
});
