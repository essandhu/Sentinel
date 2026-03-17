import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sentinel-vrt/db before importing routers
vi.mock('@sentinel-vrt/db', () => {
  const mockDb = {
    select: vi.fn(),
  };
  return {
    createDb: vi.fn(() => mockDb),
    captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId', createdAt: 'captureRuns.createdAt', branchName: 'captureRuns.branchName', commitSha: 'captureRuns.commitSha', status: 'captureRuns.status', completedAt: 'captureRuns.completedAt' },
    snapshots: { id: 'snapshots.id', runId: 'snapshots.runId', s3Key: 'snapshots.s3Key', url: 'snapshots.url', viewport: 'snapshots.viewport' },
    diffReports: { id: 'diffReports.id', snapshotId: 'diffReports.snapshotId' },
    projects: { id: 'projects.id', workspaceId: 'projects.workspaceId' },
  };
});

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  count: vi.fn((col) => ({ _type: 'count', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
}));

describe('workspaceProcedure middleware', () => {
  let mockDb: { select: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createDb } = await import('@sentinel-vrt/db');
    mockDb = (createDb as ReturnType<typeof vi.fn>)();
  });

  function setupMockDbChain(mockDb: { select: ReturnType<typeof vi.fn> }) {
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockGroupBy = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
    const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
    const mockLeftJoin2 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
    const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
    const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
    mockDb.select.mockReturnValue({ from: mockFrom });

    return mockDb;
  }

  it('allows request when ctx.auth is null (Clerk not configured / test env)', async () => {
    setupMockDbChain(mockDb);
    const { createDb } = await import('@sentinel-vrt/db');
    (createDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    const { appRouter } = await import('../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    // Should NOT throw — null auth means Clerk not configured (pass-through)
    const result = await caller.runs.list(undefined);
    expect(Array.isArray(result)).toBe(true);
  });

  it('allows request when ctx.auth.userId is a non-empty string (valid session)', async () => {
    setupMockDbChain(mockDb);
    const { createDb } = await import('@sentinel-vrt/db');
    (createDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    const { appRouter } = await import('../src/routers/index.js');
    const caller = appRouter.createCaller({
      auth: { userId: 'user_abc123', orgId: 'org_test', orgRole: 'org:admin' },
    } as any);

    // Should NOT throw — valid userId means authenticated
    const result = await caller.runs.list(undefined);
    expect(Array.isArray(result)).toBe(true);
  });

  it('throws UNAUTHORIZED when ctx.auth exists but ctx.auth.userId is falsy', async () => {
    setupMockDbChain(mockDb);
    const { createDb } = await import('@sentinel-vrt/db');
    (createDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    const { appRouter } = await import('../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: { userId: null } } as any);

    // Should throw UNAUTHORIZED — Clerk active but no valid session
    await expect(caller.runs.list(undefined)).rejects.toThrow('UNAUTHORIZED');
  });
});
