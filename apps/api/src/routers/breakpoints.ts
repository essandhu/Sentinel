import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, asc } from 'drizzle-orm';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb, breakpointPresets, projects } from '@sentinel-vrt/db';
import { BREAKPOINT_TEMPLATES } from '@sentinel-vrt/capture';

const db = createDb();

/**
 * Verify a project belongs to the caller's workspace.
 */
async function verifyProjectOwnership(projectId: string, workspaceId: string | undefined) {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      workspaceId
        ? and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId))
        : eq(projects.id, projectId),
    );

  if (rows.length === 0) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Project not found in workspace',
    });
  }
  return rows[0];
}

/**
 * Verify a breakpoint preset belongs to the caller's workspace (via its project).
 */
async function verifyPresetOwnership(presetId: string, workspaceId: string | undefined) {
  const rows = await db
    .select({
      id: breakpointPresets.id,
      projectId: breakpointPresets.projectId,
    })
    .from(breakpointPresets)
    .innerJoin(projects, eq(breakpointPresets.projectId, projects.id))
    .where(
      workspaceId
        ? and(eq(breakpointPresets.id, presetId), eq(projects.workspaceId, workspaceId))
        : eq(breakpointPresets.id, presetId),
    );

  if (rows.length === 0) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Breakpoint preset not found in workspace',
    });
  }
  return rows[0];
}

export const breakpointsRouter = t.router({
  list: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const workspaceId = (ctx as any).workspaceId;
      await verifyProjectOwnership(input.projectId, workspaceId);

      return db
        .select()
        .from(breakpointPresets)
        .where(eq(breakpointPresets.projectId, input.projectId))
        .orderBy(asc(breakpointPresets.sortOrder));
    }),

  create: workspaceProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(50),
        width: z.number().int().min(100).max(7680),
        height: z.number().int().min(100).max(4320),
        sortOrder: z.number().int().min(0).default(0),
        pixelDiffThreshold: z.number().int().min(0).max(10000).optional(),
        ssimThreshold: z.number().int().min(0).max(10000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = (ctx as any).workspaceId;
      await verifyProjectOwnership(input.projectId, workspaceId);

      const [inserted] = await db
        .insert(breakpointPresets)
        .values({
          projectId: input.projectId,
          name: input.name,
          width: input.width,
          height: input.height,
          sortOrder: input.sortOrder,
          pixelDiffThreshold: input.pixelDiffThreshold ?? null,
          ssimThreshold: input.ssimThreshold ?? null,
        })
        .returning();

      return inserted;
    }),

  update: workspaceProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(50).optional(),
        width: z.number().int().min(100).max(7680).optional(),
        height: z.number().int().min(100).max(4320).optional(),
        sortOrder: z.number().int().min(0).optional(),
        pixelDiffThreshold: z.number().int().min(0).max(10000).nullish(),
        ssimThreshold: z.number().int().min(0).max(10000).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = (ctx as any).workspaceId;
      await verifyPresetOwnership(input.id, workspaceId);

      const updateFields: Record<string, unknown> = {};
      if (input.name !== undefined) updateFields.name = input.name;
      if (input.width !== undefined) updateFields.width = input.width;
      if (input.height !== undefined) updateFields.height = input.height;
      if (input.sortOrder !== undefined) updateFields.sortOrder = input.sortOrder;
      if (input.pixelDiffThreshold !== undefined) updateFields.pixelDiffThreshold = input.pixelDiffThreshold;
      if (input.ssimThreshold !== undefined) updateFields.ssimThreshold = input.ssimThreshold;

      const [updated] = await db
        .update(breakpointPresets)
        .set(updateFields)
        .where(eq(breakpointPresets.id, input.id))
        .returning();

      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = (ctx as any).workspaceId;
      await verifyPresetOwnership(input.id, workspaceId);

      await db.delete(breakpointPresets).where(eq(breakpointPresets.id, input.id));
      return { success: true };
    }),

  applyTemplate: workspaceProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        template: z.enum(['tailwind', 'bootstrap']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = (ctx as any).workspaceId;
      await verifyProjectOwnership(input.projectId, workspaceId);

      const templatePresets = BREAKPOINT_TEMPLATES[input.template];

      const inserted = await db.transaction(async (tx) => {
        // Delete existing presets for this project
        await tx.delete(breakpointPresets).where(eq(breakpointPresets.projectId, input.projectId));

        // Insert template presets
        const rows = await tx
          .insert(breakpointPresets)
          .values(
            templatePresets.map((preset, index) => ({
              projectId: input.projectId,
              name: preset.name,
              width: preset.width,
              height: preset.height,
              sortOrder: index,
            })),
          )
          .returning();

        return rows;
      });

      return inserted;
    }),

  templates: t.procedure.query(() => {
    return BREAKPOINT_TEMPLATES;
  }),
});
