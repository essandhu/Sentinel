import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sentinel/db before importing routers
vi.mock('@sentinel/db', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  };
  return {
    createDb: vi.fn(() => mockDb),
    projects: { id: 'projects.id', workspaceId: 'projects.workspaceId', name: 'projects.name', createdAt: 'projects.createdAt' },
    captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId', createdAt: 'captureRuns.createdAt' },
    snapshots: { id: 'snapshots.id', runId: 'snapshots.runId', s3Key: 'snapshots.s3Key', url: 'snapshots.url', viewport: 'snapshots.viewport', browser: 'snapshots.browser' },
    diffReports: { id: 'diffReports.id', snapshotId: 'diffReports.snapshotId', baselineS3Key: 'diffReports.baselineS3Key', diffS3Key: 'diffReports.diffS3Key', pixelDiffPercent: 'diffReports.pixelDiffPercent', ssimScore: 'diffReports.ssimScore', passed: 'diffReports.passed', createdAt: 'diffReports.createdAt' },
    baselines: { id: 'baselines.id', projectId: 'baselines.projectId', url: 'baselines.url', viewport: 'baselines.viewport', s3Key: 'baselines.s3Key', snapshotId: 'baselines.snapshotId', approvedBy: 'baselines.approvedBy', createdAt: 'baselines.createdAt' },
    approvalDecisions: { id: 'approvalDecisions.id', diffReportId: 'approvalDecisions.diffReportId', action: 'approvalDecisions.action', userId: 'approvalDecisions.userId', userEmail: 'approvalDecisions.userEmail', reason: 'approvalDecisions.reason', jiraIssueKey: 'approvalDecisions.jiraIssueKey', createdAt: 'approvalDecisions.createdAt' },
    workspaceSettings: {
      id: 'workspaceSettings.id',
      workspaceId: 'workspaceSettings.workspaceId',
      slackWebhookUrl: 'workspaceSettings.slackWebhookUrl',
      jiraHost: 'workspaceSettings.jiraHost',
      jiraEmail: 'workspaceSettings.jiraEmail',
      jiraApiToken: 'workspaceSettings.jiraApiToken',
      jiraProjectKey: 'workspaceSettings.jiraProjectKey',
      updatedAt: 'workspaceSettings.updatedAt',
    },
    approvalChainSteps: {
      id: 'approvalChainSteps.id',
      projectId: 'approvalChainSteps.projectId',
      stepOrder: 'approvalChainSteps.stepOrder',
      label: 'approvalChainSteps.label',
      requiredRole: 'approvalChainSteps.requiredRole',
      requiredUserId: 'approvalChainSteps.requiredUserId',
      createdAt: 'approvalChainSteps.createdAt',
    },
    approvalChainProgress: {
      id: 'approvalChainProgress.id',
      diffReportId: 'approvalChainProgress.diffReportId',
      stepId: 'approvalChainProgress.stepId',
      stepOrder: 'approvalChainProgress.stepOrder',
      userId: 'approvalChainProgress.userId',
      userEmail: 'approvalChainProgress.userEmail',
      completedAt: 'approvalChainProgress.completedAt',
    },
  };
});

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  asc: vi.fn((col) => ({ _type: 'asc', col })),
  count: vi.fn((col) => ({ _type: 'count', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
}));

vi.mock('../src/services/crypto.js', () => ({
  decrypt: vi.fn((v: string) => v),
  encrypt: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../src/services/jira-service.js', () => ({
  createJiraIssue: vi.fn().mockResolvedValue('MOCK-1'),
  attachToJiraIssue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@sentinel/storage', () => ({
  createStorageClient: vi.fn().mockReturnValue({}),
  downloadBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
}));

describe('reviewerProcedure role enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows request when auth is null (dev/test pass-through)', async () => {
    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);
    const { createDb } = await import('@sentinel/db');
    const mockDb = (createDb as ReturnType<typeof vi.fn>)();

    // Chainable select helper
    const makeChain = (resolveValue: any[]) => {
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

    // First select: diff ownership, second: getChainForProject (empty = no chain)
    mockDb.select
      .mockReturnValueOnce(makeChain([{
        diffId: 'diff-1', snapshotId: 'snap-1', url: 'https://example.com',
        viewport: '1280x720', browser: 'firefox', s3Key: 'screenshots/abc.png', projectId: 'proj-1',
      }]))
      .mockReturnValue(makeChain([]));

    // Mock insert chain for baselines and approvalDecisions
    const mockValues = vi.fn().mockResolvedValue([{ id: 'new-id' }]);
    mockDb.insert.mockReturnValue({ values: mockValues });

    // Should not throw auth error
    const result = await caller.approvals.approve({
      diffReportId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    expect(result).toEqual({ success: true });
  });

  it('allows request when orgRole is org:admin', async () => {
    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({
      auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin', sessionClaims: { email: 'admin@test.com' } },
    } as any);

    const { createDb } = await import('@sentinel/db');
    const mockDb = (createDb as ReturnType<typeof vi.fn>)();

    const makeChain = (resolveValue: any[]) => {
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

    mockDb.select
      .mockReturnValueOnce(makeChain([{
        diffId: 'diff-1', snapshotId: 'snap-1', url: 'https://example.com',
        viewport: '1280x720', browser: 'firefox', s3Key: 'screenshots/abc.png', projectId: 'proj-1',
      }]))
      .mockReturnValue(makeChain([]));

    const mockValues = vi.fn().mockResolvedValue([{ id: 'new-id' }]);
    mockDb.insert.mockReturnValue({ values: mockValues });

    const result = await caller.approvals.approve({
      diffReportId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    expect(result).toEqual({ success: true });
  });

  it('allows request when orgRole is org:member', async () => {
    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({
      auth: { userId: 'user-2', orgId: 'org-1', orgRole: 'org:member', sessionClaims: { email: 'member@test.com' } },
    } as any);

    const { createDb } = await import('@sentinel/db');
    const mockDb = (createDb as ReturnType<typeof vi.fn>)();

    const makeChain = (resolveValue: any[]) => {
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

    mockDb.select
      .mockReturnValueOnce(makeChain([{
        diffId: 'diff-1', snapshotId: 'snap-1', url: 'https://example.com',
        viewport: '1280x720', browser: 'firefox', s3Key: 'screenshots/abc.png', projectId: 'proj-1',
      }]))
      .mockReturnValue(makeChain([]));

    const mockValues = vi.fn().mockResolvedValue([{ id: 'new-id' }]);
    mockDb.insert.mockReturnValue({ values: mockValues });

    const result = await caller.approvals.approve({
      diffReportId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    expect(result).toEqual({ success: true });
  });

  it('throws FORBIDDEN when orgRole is org:viewer', async () => {
    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({
      auth: { userId: 'user-3', orgId: 'org-1', orgRole: 'org:viewer', sessionClaims: { email: 'viewer@test.com' } },
    } as any);

    await expect(
      caller.approvals.approve({
        diffReportId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      }),
    ).rejects.toThrow('Reviewer role required');
  });
});

describe('approvals router endpoints', () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };

  function setupMockDb() {
    const mockReturning = vi.fn().mockResolvedValue([{ id: 'new-id' }]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    mockDb.insert.mockReturnValue({ values: mockValues });
    return { mockValues, mockReturning };
  }

  /** Build a chainable select mock that resolves to the given value */
  function makeChainableSelect(resolveValue: any[]) {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(fn);
    return chain;
  }

  function setupDiffLookup(results: any[] = [{
    diffId: 'diff-1', snapshotId: 'snap-1', url: 'https://example.com',
    viewport: '1280x720', browser: 'firefox', s3Key: 'screenshots/abc.png', projectId: 'proj-1',
  }]) {
    // First select: diff ownership (returns diff info)
    // Second select: getChainForProject (returns empty = no chain = legacy path)
    mockDb.select
      .mockReturnValueOnce(makeChainableSelect(results))
      .mockReturnValue(makeChainableSelect([]));
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createDb } = await import('@sentinel/db');
    mockDb = (createDb as ReturnType<typeof vi.fn>)();
  });

  it('approve inserts a baseline row and an approval_decisions row', async () => {
    setupDiffLookup();
    const { mockValues } = setupMockDb();

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.approvals.approve({
      diffReportId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });

    expect(result).toEqual({ success: true });
    // Should have called insert twice: once for baselines, once for approvalDecisions
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
    // Baseline insert must propagate browser from snapshot
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ browser: 'firefox' }));
  });

  it('approve verifies diff belongs to workspace (NOT_FOUND if cross-tenant)', async () => {
    // Return empty array to simulate diff not found in workspace
    setupDiffLookup([]);

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({
      auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin', sessionClaims: { email: 'admin@test.com' } },
    } as any);

    await expect(
      caller.approvals.approve({
        diffReportId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      }),
    ).rejects.toThrow('Diff report not found in workspace');
  });

  it('reject inserts an approval_decisions row with action rejected, NO baseline row', async () => {
    // First select: diff ownership lookup (innerJoin chain)
    const mockWhere = vi.fn().mockResolvedValue([{
      diffId: 'diff-1', snapshotId: 'snap-1', url: 'https://example.com',
      viewport: '1280x720', browser: 'firefox', s3Key: 'screenshots/abc.png', diffS3Key: 'diffs/abc.png', projectId: 'proj-1',
    }]);
    const mockInnerJoin3 = vi.fn().mockReturnValue({ where: mockWhere });
    const mockInnerJoin2 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin3 });
    const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
    const mockFrom1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });

    // Second select: workspace settings lookup (from -> where chain, no Jira settings)
    const mockSettingsWhere = vi.fn().mockResolvedValue([]);
    const mockFrom2 = vi.fn().mockReturnValue({ where: mockSettingsWhere });

    mockDb.select
      .mockReturnValueOnce({ from: mockFrom1 })
      .mockReturnValueOnce({ from: mockFrom2 });

    const { mockReturning } = setupMockDb();

    // Mock db.update chain for Jira issue key storage
    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update.mockReturnValue({ set: mockSet });

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.approvals.reject({
      diffReportId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });

    expect(result).toEqual({ success: true });
    // Should have called insert only ONCE (approvalDecisions only, no baselines)
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('defer requires reason (Zod validation fails without it)', async () => {
    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    await expect(
      caller.approvals.defer({
        diffReportId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      } as any),
    ).rejects.toThrow();

    // Also test empty string fails
    await expect(
      caller.approvals.defer({
        diffReportId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        reason: '',
      }),
    ).rejects.toThrow();
  });

  it('bulkApprove inserts baseline + audit rows for all failed diffs in run', async () => {
    // Setup select for failed diffs lookup
    const failedDiffs = [
      { diffId: 'diff-1', snapshotId: 'snap-1', url: 'https://a.com', viewport: '1280x720', browser: 'firefox', s3Key: 'k1', projectId: 'p1' },
      { diffId: 'diff-2', snapshotId: 'snap-2', url: 'https://b.com', viewport: '1280x720', browser: 'firefox', s3Key: 'k2', projectId: 'p1' },
    ];
    setupDiffLookup(failedDiffs);

    // Mock transaction: execute callback with a mock tx
    const txInsertValues = vi.fn().mockResolvedValue([{ id: 'tx-id' }]);
    const txInsert = vi.fn().mockReturnValue({ values: txInsertValues });
    // tx.select for getChainForProject inside transaction -- return empty (no chain = legacy path)
    const txMakeChain = (resolveValue: any[]) => {
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
    const txSelect = vi.fn().mockReturnValue(txMakeChain([]));
    const mockTx = { insert: txInsert, select: txSelect };
    mockDb.transaction.mockImplementation(async (cb: any) => cb(mockTx));

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.approvals.bulkApprove({
      runId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });

    expect(result).toEqual({ approvedCount: 2 });
    // 2 diffs * 2 inserts each (baseline + audit) = 4 tx.insert calls
    expect(txInsert).toHaveBeenCalledTimes(4);
    // Baseline inserts must propagate browser from snapshot
    expect(txInsertValues).toHaveBeenCalledWith(expect.objectContaining({ browser: 'firefox' }));
  });

  it('history returns audit entries for a diffReportId ordered by createdAt desc', async () => {
    const mockEntries = [
      { id: 'ad-2', diffReportId: 'diff-1', action: 'approved', userId: 'u1', userEmail: 'u@t.com', reason: null, createdAt: new Date('2026-03-04') },
      { id: 'ad-1', diffReportId: 'diff-1', action: 'rejected', userId: 'u2', userEmail: 'u2@t.com', reason: 'bad', createdAt: new Date('2026-03-03') },
    ];

    // Mock select chain: select().from().where().orderBy()
    const mockOrderBy = vi.fn().mockResolvedValue(mockEntries);
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.approvals.history({
      diffReportId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });

    expect(result).toHaveLength(2);
    expect(result[0].action).toBe('approved');
    expect(result[1].action).toBe('rejected');
  });

  it('history supports runId filter returning entries for diffs in that run', async () => {
    const mockEntries = [
      { id: 'ad-3', diffReportId: 'diff-2', action: 'approved', userId: 'u1', userEmail: 'u@t.com', reason: null, createdAt: new Date('2026-03-04') },
    ];

    // Mock select chain with joins: select().from().innerJoin().innerJoin().where().orderBy()
    const mockOrderBy = vi.fn().mockResolvedValue(mockEntries);
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
    const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
    const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const { appRouter } = await import('../../src/routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.approvals.history({
      runId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });

    expect(result).toHaveLength(1);
    expect(result[0].diffReportId).toBe('diff-2');
  });
});
