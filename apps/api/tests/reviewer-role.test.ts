import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sentinel-vrt/db before importing trpc
vi.mock('@sentinel-vrt/db', () => {
  const mockDb = {
    select: vi.fn(),
  };
  return {
    createDb: vi.fn(() => mockDb),
    projects: { id: 'projects.id', workspaceId: 'projects.workspaceId' },
  };
});

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  count: vi.fn((col) => ({ _type: 'count', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
}));

describe('reviewerProcedure middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows org:reviewer role through without FORBIDDEN error', async () => {
    const { t, reviewerProcedure } = await import('../src/trpc.js');

    const testRouter = t.router({
      test: reviewerProcedure.query(({ ctx }) => ({
        orgRole: (ctx as any).orgRole,
      })),
    });

    const caller = testRouter.createCaller({
      auth: { userId: 'user_1', orgId: 'org_abc', orgRole: 'org:reviewer' },
    } as any);

    const result = await caller.test();
    expect(result.orgRole).toBe('org:reviewer');
  });

  it('allows org:admin role through (regression check)', async () => {
    const { t, reviewerProcedure } = await import('../src/trpc.js');

    const testRouter = t.router({
      test: reviewerProcedure.query(({ ctx }) => ({
        orgRole: (ctx as any).orgRole,
      })),
    });

    const caller = testRouter.createCaller({
      auth: { userId: 'user_1', orgId: 'org_abc', orgRole: 'org:admin' },
    } as any);

    const result = await caller.test();
    expect(result.orgRole).toBe('org:admin');
  });

  it('allows org:member role through (regression check)', async () => {
    const { t, reviewerProcedure } = await import('../src/trpc.js');

    const testRouter = t.router({
      test: reviewerProcedure.query(({ ctx }) => ({
        orgRole: (ctx as any).orgRole,
      })),
    });

    const caller = testRouter.createCaller({
      auth: { userId: 'user_1', orgId: 'org_abc', orgRole: 'org:member' },
    } as any);

    const result = await caller.test();
    expect(result.orgRole).toBe('org:member');
  });

  it('blocks org:viewer with FORBIDDEN error', async () => {
    const { t, reviewerProcedure } = await import('../src/trpc.js');

    const testRouter = t.router({
      test: reviewerProcedure.query(() => 'ok'),
    });

    const caller = testRouter.createCaller({
      auth: { userId: 'user_1', orgId: 'org_abc', orgRole: 'org:viewer' },
    } as any);

    await expect(caller.test()).rejects.toThrow('Reviewer role required');
  });

  it('passes through when auth is null (no Clerk configured)', async () => {
    const { t, reviewerProcedure } = await import('../src/trpc.js');

    const testRouter = t.router({
      test: reviewerProcedure.query(({ ctx }) => ({
        workspaceId: (ctx as any).workspaceId,
      })),
    });

    const caller = testRouter.createCaller({ auth: null } as any);

    const result = await caller.test();
    expect(result.workspaceId).toBe('default');
  });
});
