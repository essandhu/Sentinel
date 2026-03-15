import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { t } from '../trpc.js';
import { workspaceProcedure, adminProcedure } from '../trpc.js';
import { createDb, workspaceSettings } from '@sentinel/db';
import { encrypt } from '../services/crypto.js';

export const settingsRouter = t.router({
  get: workspaceProcedure.query(async ({ ctx }) => {
    const db = createDb();
    const workspaceId = (ctx as any).workspaceId ?? 'default';

    const rows = await db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, workspaceId));

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      slackWebhookUrl: row.slackWebhookUrl ? '***configured***' : null,
      jiraHost: row.jiraHost,
      jiraEmail: row.jiraEmail,
      jiraApiToken: row.jiraApiToken ? '***configured***' : null,
      jiraProjectKey: row.jiraProjectKey,
    };
  }),

  update: adminProcedure
    .input(
      z.object({
        slackWebhookUrl: z.string().url().nullish(),
        jiraHost: z.string().nullish(),
        jiraEmail: z.string().email().nullish(),
        jiraApiToken: z.string().nullish(),
        jiraProjectKey: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const workspaceId = (ctx as any).workspaceId ?? 'default';

      // Build values, encrypting secrets
      const values: Record<string, unknown> = {
        workspaceId,
        updatedAt: new Date(),
      };

      if (input.slackWebhookUrl !== undefined) {
        values.slackWebhookUrl =
          input.slackWebhookUrl != null
            ? encrypt(input.slackWebhookUrl)
            : null;
      }

      if (input.jiraHost !== undefined) {
        values.jiraHost = input.jiraHost;
      }

      if (input.jiraEmail !== undefined) {
        values.jiraEmail = input.jiraEmail;
      }

      if (input.jiraApiToken !== undefined) {
        values.jiraApiToken =
          input.jiraApiToken != null ? encrypt(input.jiraApiToken) : null;
      }

      if (input.jiraProjectKey !== undefined) {
        values.jiraProjectKey = input.jiraProjectKey;
      }

      // Build the set clause for conflict update (same fields minus workspaceId)
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
});
