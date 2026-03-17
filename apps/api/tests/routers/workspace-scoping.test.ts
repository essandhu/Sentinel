import { describe, it, expect, vi, beforeEach } from 'vitest';

const FIXED_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MOCK_JOB_ID = 'job-123';

// Mock node:crypto
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => FIXED_UUID),
}));

// Mock @sentinel-vrt/db
const mockInsert = vi.fn();
const mockValues = vi.fn().mockResolvedValue(undefined);
mockInsert.mockReturnValue({ values: mockValues });

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

vi.mock('@sentinel-vrt/db', () => {
  const mockDb = {
    select: mockSelect,
    insert: mockInsert,
  };
  return {
    createDb: vi.fn(() => mockDb),
    projects: { id: 'projects.id', workspaceId: 'projects.workspaceId', name: 'projects.name', createdAt: 'projects.createdAt' },
    captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId', createdAt: 'captureRuns.createdAt', branchName: 'captureRuns.branchName', commitSha: 'captureRuns.commitSha', status: 'captureRuns.status', completedAt: 'captureRuns.completedAt' },
    snapshots: { id: 'snapshots.id', runId: 'snapshots.runId', s3Key: 'snapshots.s3Key', url: 'snapshots.url', viewport: 'snapshots.viewport' },
    diffReports: { id: 'diffReports.id', snapshotId: 'diffReports.snapshotId', baselineS3Key: 'diffReports.baselineS3Key', diffS3Key: 'diffReports.diffS3Key', pixelDiffPercent: 'diffReports.pixelDiffPercent', ssimScore: 'diffReports.ssimScore', passed: 'diffReports.passed' },
  };
});

const eqMock = vi.fn((a: unknown, b: unknown) => ({ _type: 'eq', a, b }));
const andMock = vi.fn((...args: unknown[]) => ({ _type: 'and', args }));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col: unknown) => ({ _type: 'desc', col })),
  eq: eqMock,
  and: andMock,
  count: vi.fn((col: unknown) => ({ _type: 'count', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
}));

// Mock the queue module
const mockQueueAdd = vi.fn().mockResolvedValue({ id: MOCK_JOB_ID });

vi.mock('../../src/queue.js', () => ({
  getCaptureQueue: vi.fn(() => ({
    add: mockQueueAdd,
  })),
}));

describe('cross-tenant workspace isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: project ownership returns a match
    mockSelectWhere.mockResolvedValue([{ id: 'proj-1' }]);
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockInsert.mockReturnValue({ values: mockValues });
  });

  it('runs.list scopes query by workspace_id', async () => {
    // Build mock chain for workspace-scoped runs query
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockGroupBy = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
    const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
    const mockLeftJoin2 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
    const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
    const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
    mockSelect.mockReturnValue({ from: mockFrom });

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({
      auth: { userId: 'u1', orgId: 'org_A', orgRole: 'org:admin' },
    } as any);

    await caller.runs.list(undefined);

    // Verify eq was called with workspace_id column and org_A
    const eqCalls = eqMock.mock.calls;
    const workspaceFilter = eqCalls.find(
      (call: unknown[]) => call[0] === 'projects.workspaceId' && call[1] === 'org_A'
    );
    expect(workspaceFilter).toBeDefined();
  });

  it('diffs.byRunId scopes query by workspace_id', async () => {
    // Build mock chain for workspace-scoped diffs query
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockInnerJoin3 = vi.fn().mockReturnValue({ where: mockWhere });
    const mockInnerJoin2 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin3 });
    const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
    const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
    mockSelect.mockReturnValue({ from: mockFrom });

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({
      auth: { userId: 'u1', orgId: 'org_A', orgRole: 'org:admin' },
    } as any);

    await caller.diffs.byRunId({ runId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });

    // Verify eq was called with workspace_id column and org_A
    const eqCalls = eqMock.mock.calls;
    const workspaceFilter = eqCalls.find(
      (call: unknown[]) => call[0] === 'projects.workspaceId' && call[1] === 'org_A'
    );
    expect(workspaceFilter).toBeDefined();
  });

  it('captures.start rejects project from different workspace', async () => {
    // Mock project lookup returns empty (project not in this workspace)
    mockSelectWhere.mockResolvedValue([]);

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({
      auth: { userId: 'u1', orgId: 'org_A', orgRole: 'org:admin' },
    } as any);

    await expect(
      caller.captures.start({
        projectId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        configPath: './sentinel.config.yml',
      })
    ).rejects.toThrow('Project does not belong to this workspace');
  });

  it('captures.start allows project in same workspace', async () => {
    // Mock project lookup returns a result (project is in workspace)
    mockSelectWhere.mockResolvedValue([{ id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' }]);

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({
      auth: { userId: 'u1', orgId: 'org_A', orgRole: 'org:admin' },
    } as any);

    const result = await caller.captures.start({
      projectId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      configPath: './sentinel.config.yml',
    });

    expect(result).toHaveProperty('runId');
    expect(result).toHaveProperty('jobId');
  });

  it('runs.list rejects when no orgId', async () => {
    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({
      auth: { userId: 'u1' },
    } as any);

    await expect(caller.runs.list(undefined)).rejects.toThrow('No active workspace selected');
  });

  it('diffs.byRunId rejects when no orgId', async () => {
    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({
      auth: { userId: 'u1' },
    } as any);

    await expect(
      caller.diffs.byRunId({ runId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
    ).rejects.toThrow('No active workspace selected');
  });

  it('captures.start rejects when no orgId', async () => {
    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({
      auth: { userId: 'u1' },
    } as any);

    await expect(
      caller.captures.start({
        projectId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        configPath: './sentinel.config.yml',
      })
    ).rejects.toThrow('No active workspace selected');
  });
});
