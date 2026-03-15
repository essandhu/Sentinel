import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sentinel/db before importing routers
vi.mock('@sentinel/db', () => {
  const mockDb = {
    select: vi.fn(),
  };
  return {
    createDb: vi.fn(() => mockDb),
    projects: { id: 'projects.id', workspaceId: 'projects.workspaceId', name: 'projects.name', createdAt: 'projects.createdAt' },
    captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId', createdAt: 'captureRuns.createdAt' },
    snapshots: { id: 'snapshots.id', runId: 'snapshots.runId', s3Key: 'snapshots.s3Key', url: 'snapshots.url', viewport: 'snapshots.viewport' },
    diffReports: { id: 'diffReports.id', snapshotId: 'diffReports.snapshotId', baselineS3Key: 'diffReports.baselineS3Key', diffS3Key: 'diffReports.diffS3Key', pixelDiffPercent: 'diffReports.pixelDiffPercent', ssimScore: 'diffReports.ssimScore', passed: 'diffReports.passed' },
  };
});

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  count: vi.fn((col) => ({ _type: 'count', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
}));

describe('diffs router', () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createDb } = await import('@sentinel/db');
    mockDb = (createDb as ReturnType<typeof vi.fn>)();
  });

  it('Test 1: diffs.byRunId returns diff objects with snapshotS3Key', async () => {
    const mockResult = [
      {
        id: 'diff-1',
        snapshotId: 'snap-1',
        snapshotS3Key: 'screenshots/abc.png',
        url: 'https://example.com',
        viewport: '1280x720',
        baselineS3Key: 'baselines/base.png',
        diffS3Key: 'diffs/diff.png',
        pixelDiffPercent: 250,
        ssimScore: 9800,
        passed: 'true',
      },
    ];

    // Build mock chain: select().from().innerJoin().innerJoin().innerJoin().where()
    const mockWhere = vi.fn().mockResolvedValue(mockResult);
    const mockInnerJoin3 = vi.fn().mockReturnValue({ where: mockWhere });
    const mockInnerJoin2 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin3 });
    const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
    const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const { createDb } = await import('@sentinel/db');
    (createDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.diffs.byRunId({ runId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'diff-1',
      snapshotId: 'snap-1',
      snapshotS3Key: 'screenshots/abc.png',
      url: 'https://example.com',
      viewport: '1280x720',
    });
  });

  it('Test 2: diffs.byRunId returns empty array when no diffs exist', async () => {
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockInnerJoin3 = vi.fn().mockReturnValue({ where: mockWhere });
    const mockInnerJoin2 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin3 });
    const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
    const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const { createDb } = await import('@sentinel/db');
    (createDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.diffs.byRunId({ runId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('Test 3: diffs.byRunId select includes snapshotS3Key from snapshots.s3Key', async () => {
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockInnerJoin3 = vi.fn().mockReturnValue({ where: mockWhere });
    const mockInnerJoin2 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin3 });
    const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
    const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const { createDb } = await import('@sentinel/db');
    (createDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    await caller.diffs.byRunId({ runId: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });

    // Verify that select was called with an object containing snapshotS3Key
    expect(mockDb.select).toHaveBeenCalled();
    const selectArg = mockDb.select.mock.calls[0][0];
    expect(selectArg).toHaveProperty('snapshotS3Key');
  });

  it('Test 4: diffs.byRunId includes pixelDiffPercent and ssimScore as raw integers', async () => {
    const mockResult = [
      {
        id: 'diff-2',
        snapshotId: 'snap-2',
        snapshotS3Key: 'screenshots/xyz.png',
        url: 'https://example.com/page',
        viewport: '768x1024',
        baselineS3Key: 'baselines/base2.png',
        diffS3Key: 'diffs/diff2.png',
        pixelDiffPercent: 500,   // basis points
        ssimScore: 9500,         // 0-10000 scale
        passed: 'false',
      },
    ];

    const mockWhere = vi.fn().mockResolvedValue(mockResult);
    const mockInnerJoin3 = vi.fn().mockReturnValue({ where: mockWhere });
    const mockInnerJoin2 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin3 });
    const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
    const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const { createDb } = await import('@sentinel/db');
    (createDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.diffs.byRunId({ runId: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });

    expect(result[0].pixelDiffPercent).toBe(500);
    expect(result[0].ssimScore).toBe(9500);
  });
});
