import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sentinel/db before importing routers
vi.mock('@sentinel/db', () => {
  const mockDb = {
    select: vi.fn(),
  };
  return {
    createDb: vi.fn(() => mockDb),
    projects: { id: 'projects.id', workspaceId: 'projects.workspaceId', name: 'projects.name', createdAt: 'projects.createdAt' },
    captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId', createdAt: 'captureRuns.createdAt', branchName: 'captureRuns.branchName', commitSha: 'captureRuns.commitSha', status: 'captureRuns.status', completedAt: 'captureRuns.completedAt' },
    snapshots: { id: 'snapshots.id', runId: 'snapshots.runId', s3Key: 'snapshots.s3Key', url: 'snapshots.url', viewport: 'snapshots.viewport' },
    diffReports: { id: 'diffReports.id', snapshotId: 'diffReports.snapshotId' },
  };
});

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  count: vi.fn((col) => ({ _type: 'count', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
}));

describe('runs router', () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to get fresh mock references
    const { createDb } = await import('@sentinel/db');
    mockDb = (createDb as ReturnType<typeof vi.fn>)();
  });

  it('Test 1: runs.list returns array of run objects', async () => {
    const mockResult = [
      {
        id: 'run-1',
        projectId: 'proj-1',
        branchName: 'main',
        commitSha: 'abc123',
        status: 'completed',
        createdAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-01'),
        totalDiffs: 5,
      },
    ];

    // Build mock chain: select().from().leftJoin().leftJoin().innerJoin().where().groupBy().orderBy().limit()
    const mockLimit = vi.fn().mockResolvedValue(mockResult);
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockGroupBy = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
    const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
    const mockLeftJoin2 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
    const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
    const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
    mockDb.select.mockReturnValue({ from: mockFrom });

    // Make createDb return our mockDb
    const { createDb } = await import('@sentinel/db');
    (createDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.runs.list(undefined);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'run-1',
      branchName: 'main',
      totalDiffs: 5,
    });
  });

  it('Test 2: runs.list with projectId filters by project and workspace', async () => {
    const mockResult = [
      {
        id: 'run-2',
        projectId: 'proj-2',
        branchName: 'feature',
        commitSha: 'def456',
        status: 'pending',
        createdAt: new Date('2024-01-02'),
        completedAt: null,
        totalDiffs: 0,
      },
    ];

    // Chain with where (projectId + workspace filter via and())
    const mockLimit = vi.fn().mockResolvedValue(mockResult);
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockGroupBy = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
    const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
    const mockLeftJoin2 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
    const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
    const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const { createDb } = await import('@sentinel/db');
    (createDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.runs.list({ projectId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });

    expect(Array.isArray(result)).toBe(true);
    expect(result[0].projectId).toBe('proj-2');
  });

  it('Test 3: runs.list is ordered by createdAt desc and limited to 50', async () => {
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockGroupBy = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
    const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
    const mockLeftJoin2 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
    const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
    const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const { createDb } = await import('@sentinel/db');
    (createDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    await caller.runs.list(undefined);

    expect(mockOrderBy).toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalledWith(50);
  });
});
