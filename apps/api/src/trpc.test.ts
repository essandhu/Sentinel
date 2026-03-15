import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTRPC, TRPCError } from '@trpc/server';

// We test the middleware logic by importing the real module.
// The trpc module exports procedures that wrap middlewares; we need to
// exercise them through a minimal tRPC caller.
import { t, protectedProcedure, workspaceProcedure, adminProcedure, reviewerProcedure } from './trpc.js';

/** Helper: create a tRPC caller with the given context */
function createCaller(ctx: any) {
  // Build a minimal router that surfaces each procedure
  const router = t.router({
    protected: protectedProcedure.query(({ ctx }) => ({ ok: true, ctx })),
    workspace: workspaceProcedure.query(({ ctx }) => ({ ok: true, ctx })),
    admin: adminProcedure.query(({ ctx }) => ({ ok: true, ctx })),
    reviewer: reviewerProcedure.query(({ ctx }) => ({ ok: true, ctx })),
  });

  return t.createCallerFactory(router)(ctx);
}

describe('trpc middlewares', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('protectedProcedure', () => {
    it('passes through when ctx.auth is null (no Clerk)', async () => {
      const caller = createCaller({ auth: null, db: {} });
      const result = await caller.protected();
      expect(result.ok).toBe(true);
    });

    it('passes through when ctx.auth has valid userId', async () => {
      const caller = createCaller({ auth: { userId: 'user-1' }, db: {} });
      const result = await caller.protected();
      expect(result.ok).toBe(true);
    });

    it('throws UNAUTHORIZED when auth exists but userId is falsy', async () => {
      const caller = createCaller({ auth: { userId: null }, db: {} });
      await expect(caller.protected()).rejects.toThrow(TRPCError);
      try {
        await caller.protected();
      } catch (e: any) {
        expect(e.code).toBe('UNAUTHORIZED');
      }
    });
  });

  describe('workspaceProcedure', () => {
    it('passes through with undefined workspaceId when ctx.auth is null', async () => {
      const caller = createCaller({ auth: null, db: {} });
      const result = await caller.workspace();
      expect(result.ok).toBe(true);
      expect(result.ctx.workspaceId).toBe('default');
      expect(result.ctx.orgRole).toBeUndefined();
    });

    it('throws UNAUTHORIZED when auth exists but no userId', async () => {
      const caller = createCaller({ auth: { userId: null }, db: {} });
      await expect(caller.workspace()).rejects.toThrow(TRPCError);
    });

    it('throws FORBIDDEN when userId exists but no orgId', async () => {
      const caller = createCaller({
        auth: { userId: 'user-1', orgId: null, orgRole: null },
        db: {},
      });
      try {
        await caller.workspace();
        expect.unreachable('should have thrown');
      } catch (e: any) {
        expect(e.code).toBe('FORBIDDEN');
        expect(e.message).toMatch(/workspace/i);
      }
    });

    it('sets workspaceId and orgRole from auth when orgId is present', async () => {
      const caller = createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' },
        db: {},
      });
      const result = await caller.workspace();
      expect(result.ctx.workspaceId).toBe('org-1');
      expect(result.ctx.orgRole).toBe('org:member');
    });
  });

  describe('adminProcedure', () => {
    it('passes when orgRole is org:admin', async () => {
      const caller = createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
        db: {},
      });
      const result = await caller.admin();
      expect(result.ok).toBe(true);
    });

    it('throws FORBIDDEN when orgRole is org:member', async () => {
      const caller = createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' },
        db: {},
      });
      try {
        await caller.admin();
        expect.unreachable('should have thrown');
      } catch (e: any) {
        expect(e.code).toBe('FORBIDDEN');
        expect(e.message).toMatch(/admin/i);
      }
    });

    it('throws FORBIDDEN when orgRole is org:viewer', async () => {
      const caller = createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:viewer' },
        db: {},
      });
      await expect(caller.admin()).rejects.toThrow(TRPCError);
    });
  });

  describe('reviewerProcedure', () => {
    it('passes when orgRole is org:admin', async () => {
      const caller = createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
        db: {},
      });
      const result = await caller.reviewer();
      expect(result.ok).toBe(true);
    });

    it('passes when orgRole is org:member', async () => {
      const caller = createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' },
        db: {},
      });
      const result = await caller.reviewer();
      expect(result.ok).toBe(true);
    });

    it('passes when orgRole is org:reviewer', async () => {
      const caller = createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:reviewer' },
        db: {},
      });
      const result = await caller.reviewer();
      expect(result.ok).toBe(true);
    });

    it('throws FORBIDDEN when orgRole is org:viewer', async () => {
      const caller = createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:viewer' },
        db: {},
      });
      try {
        await caller.reviewer();
        expect.unreachable('should have thrown');
      } catch (e: any) {
        expect(e.code).toBe('FORBIDDEN');
        expect(e.message).toMatch(/reviewer/i);
      }
    });

    it('passes through when auth is null (no Clerk)', async () => {
      const caller = createCaller({ auth: null, db: {} });
      const result = await caller.reviewer();
      expect(result.ok).toBe(true);
    });
  });
});
