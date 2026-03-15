import { eq } from 'drizzle-orm';
import { notificationPreferences, type Db } from '@sentinel/db';

export type EventType =
  | 'drift_detected'
  | 'approval_requested'
  | 'scheduled_capture_failed'
  | 'rejection_created'
  | 'environment_drift';

export type Channel = 'slack' | 'jira';

export type NotificationPreferencesMap = Record<
  EventType,
  Record<Channel, boolean>
>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesMap = {
  drift_detected: { slack: true, jira: true },
  approval_requested: { slack: true, jira: true },
  scheduled_capture_failed: { slack: true, jira: true },
  rejection_created: { slack: true, jira: true },
  environment_drift: { slack: true, jira: true },
};

/**
 * Check whether a specific event+channel notification is enabled for a workspace.
 * Returns true when no preferences row exists (all-enabled default per NOTIF-04).
 * Returns true for unknown event/channel combos (safe fallback).
 */
export async function isNotificationEnabled(
  db: Db,
  workspaceId: string,
  eventType: EventType,
  channel: Channel,
): Promise<boolean> {
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.workspaceId, workspaceId));

  if (rows.length === 0) {
    return true;
  }

  const prefs = JSON.parse(rows[0].preferences) as Partial<
    NotificationPreferencesMap
  >;
  return prefs[eventType]?.[channel] ?? true;
}
