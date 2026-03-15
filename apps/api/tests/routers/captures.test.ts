import { describe, it, expect, vi, beforeEach } from 'vitest';

const FIXED_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MOCK_JOB_ID = 'job-123';

// Track call order for DB-before-queue verification
const callOrder: string[] = [];

// Mock node:crypto
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => FIXED_UUID),
}));

// Mock @sentinel/db
const mockInsert = vi.fn();
const mockValues = vi.fn().mockImplementation(() => {
  callOrder.push('db.insert');
  return Promise.resolve();
});
mockInsert.mockReturnValue({ values: mockValues });

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

vi.mock('@sentinel/db', () => {
  const mockDb = {
    select: mockSelect,
    insert: mockInsert,
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

// Mock the queue module
const mockQueueAdd = vi.fn().mockImplementation(async () => {
  callOrder.push('queue.add');
  return { id: MOCK_JOB_ID };
});

vi.mock('../../src/queue.js', () => ({
  getCaptureQueue: vi.fn(() => ({
    add: mockQueueAdd,
  })),
}));

describe('captures router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    // Default: project ownership check returns a match (project in workspace)
    mockSelectWhere.mockResolvedValue([{ id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' }]);
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockInsert.mockReturnValue({ values: mockValues });
  });

  it('captures.start with valid input returns { runId, jobId }', async () => {
    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.captures.start({
      projectId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      configPath: './sentinel.config.yml',
    });

    expect(result).toEqual({
      runId: FIXED_UUID,
      jobId: MOCK_JOB_ID,
    });
  });

  it('captures.start calls db.insert before Queue.add (order matters)', async () => {
    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    await caller.captures.start({
      projectId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      configPath: './sentinel.config.yml',
    });

    expect(callOrder).toEqual(['db.insert', 'queue.add']);
  });

  it('captures.start with invalid projectId (not UUID) throws input validation error', async () => {
    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    await expect(
      caller.captures.start({
        projectId: 'not-a-uuid',
        configPath: './sentinel.config.yml',
      })
    ).rejects.toThrow();
  });

  it('captures.start with empty configPath throws input validation error', async () => {
    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    await expect(
      caller.captures.start({
        projectId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        configPath: '',
      })
    ).rejects.toThrow();
  });

  it('captures.start throws FORBIDDEN when project not in workspace', async () => {
    // Mock project lookup to return empty (project not in workspace)
    mockSelectWhere.mockResolvedValue([]);

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    await expect(
      caller.captures.start({
        projectId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        configPath: './sentinel.config.yml',
      })
    ).rejects.toThrow('Project does not belong to this workspace');
  });
});
