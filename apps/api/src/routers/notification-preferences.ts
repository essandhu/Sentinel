import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { t, workspaceProcedure, adminProcedure } from '../trpc.js';
import { createDb, notificationPreferences } from '@sentinel/db';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferencesMap,
} from '../services/notification-preferences.js';

const EVENT_TYPES = [
  'drift_detected',
  'approval_requested',
  'scheduled_capture_failed',
  'rejection_created',
] as const;

const CHANNELS = ['slack', 'jira'] as const;

export const notificationPreferencesRouter = t.router({
  get: workspaceProcedure.query(async ({ ctx }) => {
    const db = createDb();
    const workspaceId = (ctx as any).workspaceId ?? 'default';

    const rows = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.workspaceId, workspaceId));

    if (rows.length === 0) {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    return JSON.parse(rows[0].preferences) as NotificationPreferencesMap;
  }),

  update: adminProcedure
    .input(
      z.object({
        preferences: z.record(
          z.enum(EVENT_TYPES),
          z.record(z.enum(CHANNELS), z.boolean()),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const workspaceId = (ctx as any).workspaceId ?? 'default';

      const preferencesJson = JSON.stringify(input.preferences);

      await db
        .insert(notificationPreferences)
        .values({
          workspaceId,
          preferences: preferencesJson,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: notificationPreferences.workspaceId,
          set: {
            preferences: preferencesJson,
            updatedAt: new Date(),
          },
        });

      return { success: true };
    }),
});
