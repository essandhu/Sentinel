import { z } from 'zod';
import { createClerkClient } from '@clerk/backend';
import { t } from '../trpc.js';
import { workspaceProcedure, adminProcedure } from '../trpc.js';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const orgRoleSchema = z.enum(['org:admin', 'org:reviewer', 'org:viewer']);

export const workspacesRouter = t.router({
  /**
   * Create a new workspace (Clerk Organization).
   * Requires an active workspace context (workspaceProcedure).
   */
  create: workspaceProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const result = await clerkClient.organizations.createOrganization({
        name: input.name,
        createdBy: ctx.auth!.userId!,
      });
      return { organizationId: result.id, name: result.name };
    }),

  /**
   * Invite a member to the workspace by email.
   * Admin-only procedure.
   */
  invite: adminProcedure
    .input(
      z.object({
        emailAddress: z.string().email(),
        role: orgRoleSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const result =
        await clerkClient.organizations.createOrganizationInvitation({
          organizationId: (ctx as any).workspaceId,
          inviterUserId: ctx.auth!.userId!,
          emailAddress: input.emailAddress,
          role: input.role,
        });
      return { invitationId: result.id };
    }),

  /**
   * Change a workspace member's role.
   * Admin-only procedure.
   */
  changeRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: orgRoleSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await clerkClient.organizations.updateOrganizationMembership({
        organizationId: (ctx as any).workspaceId,
        userId: input.userId,
        role: input.role,
      });
      return { userId: input.userId, role: input.role };
    }),

  /**
   * List all members of the current workspace.
   * Requires an active workspace context.
   */
  members: workspaceProcedure.query(async ({ ctx }) => {
    const result =
      await clerkClient.organizations.getOrganizationMembershipList({
        organizationId: (ctx as any).workspaceId,
      });
    return result.data.map((member: any) => ({
      userId: member.publicUserData.userId,
      role: member.role,
      identifier: member.publicUserData.identifier,
    }));
  }),
});
