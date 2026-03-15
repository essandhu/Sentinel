import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sentinel/db before importing routers
vi.mock('@sentinel/db', () => {
  const mockDb = {
    select: vi.fn(),
  };
  return {
    createDb: vi.fn(() => mockDb),
    projects: { id: 'projects.id', name: 'projects.name', workspaceId: 'projects.workspaceId', createdAt: 'projects.createdAt' },
    captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId', createdAt: 'captureRuns.createdAt' },
    snapshots: { id: 'snapshots.id', runId: 'snapshots.runId' },
    diffReports: { id: 'diffReports.id', snapshotId: 'diffReports.snapshotId' },
  };
});

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  count: vi.fn((col) => ({ _type: 'count', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
}));

describe('workspaceProcedure middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows request when auth.orgId is present, injecting workspaceId and orgRole into context', async () => {
    const { t, workspaceProcedure } = await import('../src/trpc.js');

    // Create a test router with a procedure that returns context info
    const testRouter = t.router({
      test: workspaceProcedure.query(({ ctx }) => {
        return {
          workspaceId: (ctx as any).workspaceId,
          orgRole: (ctx as any).orgRole,
        };
      }),
    });

    const caller = testRouter.createCaller({
      auth: { userId: 'user_1', orgId: 'org_abc', orgRole: 'org:admin' },
    } as any);

    const result = await caller.test();
    expect(result.workspaceId).toBe('org_abc');
    expect(result.orgRole).toBe('org:admin');
  });

  it('throws FORBIDDEN with "No active workspace selected" when auth.orgId is undefined', async () => {
    const { t, workspaceProcedure } = await import('../src/trpc.js');

    const testRouter = t.router({
      test: workspaceProcedure.query(() => 'ok'),
    });

    const caller = testRouter.createCaller({
      auth: { userId: 'user_1', orgId: undefined, orgRole: undefined },
    } as any);

    await expect(caller.test()).rejects.toThrow('No active workspace selected');
  });

  it('throws UNAUTHORIZED when auth exists but userId is falsy', async () => {
    const { t, workspaceProcedure } = await import('../src/trpc.js');

    const testRouter = t.router({
      test: workspaceProcedure.query(() => 'ok'),
    });

    const caller = testRouter.createCaller({
      auth: { userId: null, orgId: undefined },
    } as any);

    await expect(caller.test()).rejects.toThrow('UNAUTHORIZED');
  });

  it('allows request when auth is null (Clerk not configured) with workspaceId undefined', async () => {
    const { t, workspaceProcedure } = await import('../src/trpc.js');

    const testRouter = t.router({
      test: workspaceProcedure.query(({ ctx }) => {
        return { workspaceId: (ctx as any).workspaceId };
      }),
    });

    const caller = testRouter.createCaller({ auth: null } as any);

    const result = await caller.test();
    expect(result.workspaceId).toBe('default');
  });
});

describe('adminProcedure middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows request when orgRole is org:admin', async () => {
    const { t, adminProcedure } = await import('../src/trpc.js');

    const testRouter = t.router({
      test: adminProcedure.query(() => 'admin-ok'),
    });

    const caller = testRouter.createCaller({
      auth: { userId: 'user_1', orgId: 'org_abc', orgRole: 'org:admin' },
    } as any);

    const result = await caller.test();
    expect(result).toBe('admin-ok');
  });

  it('throws FORBIDDEN with "Admin role required" when orgRole is not org:admin', async () => {
    const { t, adminProcedure } = await import('../src/trpc.js');

    const testRouter = t.router({
      test: adminProcedure.query(() => 'admin-ok'),
    });

    const caller = testRouter.createCaller({
      auth: { userId: 'user_1', orgId: 'org_abc', orgRole: 'org:viewer' },
    } as any);

    await expect(caller.test()).rejects.toThrow('Admin role required');
  });

  it('throws FORBIDDEN with "Admin role required" when orgRole is org:reviewer', async () => {
    const { t, adminProcedure } = await import('../src/trpc.js');

    const testRouter = t.router({
      test: adminProcedure.query(() => 'admin-ok'),
    });

    const caller = testRouter.createCaller({
      auth: { userId: 'user_1', orgId: 'org_abc', orgRole: 'org:reviewer' },
    } as any);

    await expect(caller.test()).rejects.toThrow('Admin role required');
  });
});
