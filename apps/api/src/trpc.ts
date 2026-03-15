import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context.js';

export const t = initTRPC.context<Context>().create();

const isAuthed = t.middleware(async (opts) => {
  const { ctx } = opts;
  // ctx.auth is null when CLERK_SECRET_KEY not set (test/dev pass-through)
  // ctx.auth exists but userId is falsy when Clerk active but no session
  if (ctx.auth && !ctx.auth.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return opts.next({ ctx });
});

export const protectedProcedure = t.procedure.use(isAuthed);

/**
 * Workspace-scoped procedure: requires active organization (orgId).
 * Injects workspaceId and orgRole into context.
 * Passes through when auth is null (Clerk not configured / test env).
 */
const isAuthedWithWorkspace = t.middleware(async (opts) => {
  const { ctx } = opts;

  // ctx.auth is null when Clerk is not configured (test/dev pass-through)
  // Use a deterministic default workspace so workspace-scoped queries work without Clerk
  if (!ctx.auth) {
    return opts.next({
      ctx: {
        ...ctx,
        workspaceId: 'default',
        orgRole: undefined,
      },
    });
  }

  // Clerk is active but no valid session
  if (!ctx.auth.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // Require active organization for workspace-scoped procedures
  const orgId = ctx.auth.orgId;
  if (!orgId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No active workspace selected',
    });
  }

  return opts.next({
    ctx: {
      ...ctx,
      workspaceId: orgId,
      orgRole: ctx.auth.orgRole,
    },
  });
});

export const workspaceProcedure = t.procedure.use(isAuthedWithWorkspace);

/**
 * Admin-only procedure: requires org:admin role.
 * Chains after workspaceProcedure (workspace context already available).
 */
const isWorkspaceAdmin = t.middleware(async (opts) => {
  const { ctx } = opts;
  if ((ctx as any).orgRole !== 'org:admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin role required',
    });
  }
  return opts.next({ ctx });
});

export const adminProcedure = workspaceProcedure.use(isWorkspaceAdmin);

/**
 * Reviewer procedure: allows org:admin, org:member, and org:reviewer roles.
 * Blocks org:viewer and other non-reviewer roles.
 * Passes through when auth is null (Clerk not configured / test env).
 */
const REVIEWER_ROLES = ['org:admin', 'org:member', 'org:reviewer'];
const isReviewer = t.middleware(async (opts) => {
  const { ctx } = opts;
  // When auth is null (no Clerk), pass through (same as workspaceProcedure)
  if (!(ctx as any).orgRole && !(ctx as any).auth) {
    return opts.next({ ctx });
  }
  const role = (ctx as any).orgRole;
  if (!REVIEWER_ROLES.includes(role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Reviewer role required',
    });
  }
  return opts.next({ ctx });
});

export const reviewerProcedure = workspaceProcedure.use(isReviewer);
