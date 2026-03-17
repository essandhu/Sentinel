import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { t, adminProcedure, workspaceProcedure } from '../trpc.js';
import { generateApiKey } from '../services/api-key-service.js';
import { createDb, apiKeys } from '@sentinel-vrt/db';

const db = createDb();

export const apiKeysRouter = t.router({
  create: adminProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const { rawKey, keyHash, keyPrefix } = generateApiKey();

      const [row] = await db
        .insert(apiKeys)
        .values({
          workspaceId: (ctx as any).workspaceId,
          name: input.name,
          keyHash,
          keyPrefix,
          createdBy: ctx.auth!.userId!,
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          createdAt: apiKeys.createdAt,
        });

      return {
        rawKey,
        keyPrefix: row.keyPrefix,
        name: row.name,
        id: row.id,
        createdAt: row.createdAt,
      };
    }),

  list: workspaceProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        createdAt: apiKeys.createdAt,
        revokedAt: apiKeys.revokedAt,
        lastUsedAt: apiKeys.lastUsedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.workspaceId, (ctx as any).workspaceId));

    return rows;
  }),

  revoke: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(apiKeys.id, input.id),
            eq(apiKeys.workspaceId, (ctx as any).workspaceId),
          ),
        );

      return { success: true as const };
    }),
});
