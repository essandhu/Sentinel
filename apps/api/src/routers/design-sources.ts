import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { t } from '../trpc.js';
import { workspaceProcedure, adminProcedure } from '../trpc.js';
import { createDb, workspaceSettings } from '@sentinel/db';
import { createStorageClient } from '@sentinel/storage';
import { encrypt, decrypt } from '../services/crypto.js';
import { writeDesignBaselines } from '../services/baseline-writer.js';
import {
  registerFigmaWebhook,
  deleteFigmaWebhook,
  validatePenpotConnection,
  PenpotAdapter,
  validateZeroheightConnection,
  ZeroheightAdapter,
} from '@sentinel/adapters';

export const designSourcesRouter = t.router({
  /**
   * Returns connection status for Figma and Penpot integrations.
   */
  status: workspaceProcedure.query(async ({ ctx }) => {
    const db = createDb();
    const workspaceId = (ctx as any).workspaceId ?? 'default';

    const rows = await db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, workspaceId));

    if (rows.length === 0) {
      return {
        figma: { connected: false, fileKey: null },
        penpot: { connected: false, instanceUrl: null },
        zeroheight: { connected: false, orgUrl: null },
      };
    }

    const row = rows[0];
    return {
      figma: {
        connected: !!row.figmaAccessToken,
        fileKey: row.figmaFileKey ?? null,
      },
      penpot: {
        connected: !!row.penpotAccessToken,
        instanceUrl: row.penpotInstanceUrl ?? null,
      },
      zeroheight: {
        connected: !!row.zeroheightAccessToken,
        orgUrl: row.zeroheightOrgUrl ?? null,
      },
    };
  }),

  /**
   * Connects Figma integration: registers webhook and stores encrypted credentials.
   */
  connectFigma: adminProcedure
    .input(
      z.object({
        accessToken: z.string(),
        fileKey: z.string(),
        webhookEndpointUrl: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const workspaceId = (ctx as any).workspaceId ?? 'default';

      // Generate random passcode for webhook HMAC verification
      const passcode = randomBytes(32).toString('hex');

      // Register webhook with Figma API
      const webhook = await registerFigmaWebhook(
        input.accessToken,
        input.fileKey,
        input.webhookEndpointUrl,
        passcode,
      );

      // Store encrypted credentials
      const values: Record<string, unknown> = {
        workspaceId,
        figmaAccessToken: encrypt(input.accessToken),
        figmaFileKey: input.fileKey,
        figmaWebhookId: webhook.id,
        figmaWebhookPasscode: encrypt(passcode),
        updatedAt: new Date(),
      };

      const { workspaceId: _wid, ...updateSet } = values;

      await db
        .insert(workspaceSettings)
        .values(values as any)
        .onConflictDoUpdate({
          target: workspaceSettings.workspaceId,
          set: updateSet as any,
        });

      return { success: true, webhookId: webhook.id };
    }),

  /**
   * Disconnects Figma integration: removes webhook and clears credentials.
   */
  disconnectFigma: adminProcedure.mutation(async ({ ctx }) => {
    const db = createDb();
    const workspaceId = (ctx as any).workspaceId ?? 'default';

    // Read current settings
    const rows = await db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, workspaceId));

    if (rows.length > 0) {
      const row = rows[0];

      // Delete webhook from Figma if it exists
      if (row.figmaWebhookId && row.figmaAccessToken) {
        await deleteFigmaWebhook(
          decrypt(row.figmaAccessToken),
          row.figmaWebhookId,
        );
      }
    }

    // Clear figma columns
    await db
      .update(workspaceSettings)
      .set({
        figmaAccessToken: null,
        figmaFileKey: null,
        figmaWebhookId: null,
        figmaWebhookPasscode: null,
        updatedAt: new Date(),
      })
      .where(eq(workspaceSettings.workspaceId, workspaceId));

    return { success: true };
  }),

  /**
   * Connects Penpot integration: validates connection and stores encrypted credentials.
   */
  connectPenpot: adminProcedure
    .input(
      z.object({
        instanceUrl: z.string().url(),
        accessToken: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const workspaceId = (ctx as any).workspaceId ?? 'default';

      // Validate the connection first
      await validatePenpotConnection(input.instanceUrl, input.accessToken);

      // Store encrypted credentials
      const values: Record<string, unknown> = {
        workspaceId,
        penpotInstanceUrl: input.instanceUrl,
        penpotAccessToken: encrypt(input.accessToken),
        updatedAt: new Date(),
      };

      const { workspaceId: _wid, ...updateSet } = values;

      await db
        .insert(workspaceSettings)
        .values(values as any)
        .onConflictDoUpdate({
          target: workspaceSettings.workspaceId,
          set: updateSet as any,
        });

      return { success: true };
    }),

  /**
   * Disconnects Penpot integration: clears credentials.
   */
  disconnectPenpot: adminProcedure.mutation(async ({ ctx }) => {
    const db = createDb();
    const workspaceId = (ctx as any).workspaceId ?? 'default';

    await db
      .update(workspaceSettings)
      .set({
        penpotInstanceUrl: null,
        penpotAccessToken: null,
        updatedAt: new Date(),
      })
      .where(eq(workspaceSettings.workspaceId, workspaceId));

    return { success: true };
  }),

  /**
   * Exports components from Penpot using stored credentials, persists baselines.
   */
  exportPenpot: workspaceProcedure
    .input(
      z.object({
        fileId: z.string(),
        projectId: z.string().uuid(),
        componentIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const workspaceId = (ctx as any).workspaceId ?? 'default';

      // Read workspace settings to get Penpot credentials
      const rows = await db
        .select()
        .from(workspaceSettings)
        .where(eq(workspaceSettings.workspaceId, workspaceId));

      const row = rows[0];
      if (!row?.penpotInstanceUrl || !row?.penpotAccessToken) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Penpot not connected',
        });
      }

      // Decrypt access token
      const accessToken = decrypt(row.penpotAccessToken);

      // Extract components via PenpotAdapter
      const adapter = new PenpotAdapter();
      const specs = await adapter.loadAll({
        instanceUrl: row.penpotInstanceUrl,
        accessToken,
        fileId: input.fileId,
        componentIds: input.componentIds,
      });

      // Persist baselines
      const storageClient = createStorageClient({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION ?? 'us-east-1',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY ?? '',
          secretAccessKey: process.env.S3_SECRET_KEY ?? '',
        },
      });

      const bucket = process.env.S3_BUCKET ?? 'sentinel';
      const userId = ctx.auth?.userId ?? 'system';

      const result = await writeDesignBaselines(
        specs,
        input.projectId,
        userId,
        storageClient,
        bucket,
        db,
      );

      return { success: true, baselineCount: result.baselineCount };
    }),

  /**
   * Connects Zeroheight integration: validates connection and stores encrypted credentials.
   */
  connectZeroheight: adminProcedure
    .input(
      z.object({
        clientId: z.string(),
        accessToken: z.string(),
        orgUrl: z.string().url(),
        styleguideId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const workspaceId = (ctx as any).workspaceId ?? 'default';

      // Validate the connection first
      await validateZeroheightConnection(
        input.clientId,
        input.accessToken,
        input.styleguideId,
      );

      // Store encrypted credentials
      const values: Record<string, unknown> = {
        workspaceId,
        zeroheightClientId: encrypt(input.clientId),
        zeroheightAccessToken: encrypt(input.accessToken),
        zeroheightOrgUrl: input.orgUrl,
        zeroheightStyleguideId: input.styleguideId,
        updatedAt: new Date(),
      };

      const { workspaceId: _wid, ...updateSet } = values;

      await db
        .insert(workspaceSettings)
        .values(values as any)
        .onConflictDoUpdate({
          target: workspaceSettings.workspaceId,
          set: updateSet as any,
        });

      return { success: true };
    }),

  /**
   * Disconnects Zeroheight integration: clears credentials.
   */
  disconnectZeroheight: adminProcedure.mutation(async ({ ctx }) => {
    const db = createDb();
    const workspaceId = (ctx as any).workspaceId ?? 'default';

    await db
      .update(workspaceSettings)
      .set({
        zeroheightClientId: null,
        zeroheightAccessToken: null,
        zeroheightOrgUrl: null,
        zeroheightStyleguideId: null,
        updatedAt: new Date(),
      })
      .where(eq(workspaceSettings.workspaceId, workspaceId));

    return { success: true };
  }),

  /**
   * Syncs tokens from Zeroheight using stored credentials.
   * Validates the pipeline works end-to-end (does not persist baselines).
   */
  syncZeroheight: workspaceProcedure
    .input(
      z.object({
        tokenSetId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const workspaceId = (ctx as any).workspaceId ?? 'default';

      // Read workspace settings
      const rows = await db
        .select()
        .from(workspaceSettings)
        .where(eq(workspaceSettings.workspaceId, workspaceId));

      const row = rows[0];
      if (!row?.zeroheightAccessToken || !row?.zeroheightClientId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Zeroheight not connected',
        });
      }

      // Decrypt credentials
      const clientId = decrypt(row.zeroheightClientId);
      const accessToken = decrypt(row.zeroheightAccessToken);

      // Fetch tokens via adapter
      const adapter = new ZeroheightAdapter();
      const specs = await adapter.loadAll({
        orgUrl: row.zeroheightOrgUrl ?? '',
        tokenSetId: input.tokenSetId ?? row.zeroheightStyleguideId ?? '',
        clientId,
        accessToken,
      });

      return {
        success: true,
        tokenCount: Object.keys(specs[0]?.tokens ?? {}).length,
      };
    }),
});
