import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Chainable mock DB ----------
function buildMockDb(selectResponses: unknown[][] = []) {
  let selectCallIdx = 0;

  const makeSelectChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(fn);
    return chain;
  };

  const db: Record<string, any> = {
    select: vi.fn((..._args: unknown[]) => {
      const response = selectResponses[selectCallIdx] ?? [];
      selectCallIdx++;
      return makeSelectChain(response);
    }),
  };

  return db;
}

// Mock @sentinel/db
vi.mock('@sentinel/db', () => ({
  createDb: vi.fn(),
  notificationPreferences: {
    id: 'notificationPreferences.id',
    workspaceId: 'notificationPreferences.workspaceId',
    preferences: 'notificationPreferences.preferences',
    updatedAt: 'notificationPreferences.updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
}));

import {
  isNotificationEnabled,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type EventType,
  type Channel,
  type NotificationPreferencesMap,
} from './notification-preferences.js';

describe('notification-preferences service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DEFAULT_NOTIFICATION_PREFERENCES', () => {
    it('has all 4 event types x 2 channels = true', () => {
      const events: EventType[] = [
        'drift_detected',
        'approval_requested',
        'scheduled_capture_failed',
        'rejection_created',
      ];
      const channels: Channel[] = ['slack', 'jira'];

      for (const event of events) {
        for (const channel of channels) {
          expect(DEFAULT_NOTIFICATION_PREFERENCES[event][channel]).toBe(true);
        }
      }
    });
  });

  describe('isNotificationEnabled', () => {
    it('returns true when no preferences row exists (default all-enabled)', async () => {
      const db = buildMockDb([[]]);
      const result = await isNotificationEnabled(
        db as any,
        'workspace-1',
        'drift_detected',
        'slack',
      );
      expect(result).toBe(true);
    });

    it('returns true when preference is explicitly enabled', async () => {
      const prefs: NotificationPreferencesMap = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        drift_detected: { slack: true, jira: true },
      };
      const db = buildMockDb([
        [{ preferences: JSON.stringify(prefs) }],
      ]);

      const result = await isNotificationEnabled(
        db as any,
        'workspace-1',
        'drift_detected',
        'slack',
      );
      expect(result).toBe(true);
    });

    it('returns false when preference is explicitly disabled', async () => {
      const prefs: NotificationPreferencesMap = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        drift_detected: { slack: false, jira: true },
      };
      const db = buildMockDb([
        [{ preferences: JSON.stringify(prefs) }],
      ]);

      const result = await isNotificationEnabled(
        db as any,
        'workspace-1',
        'drift_detected',
        'slack',
      );
      expect(result).toBe(false);
    });

    it('returns true for unknown event/channel combos (fallback)', async () => {
      // Preferences row exists but with partial data
      const prefs = {
        drift_detected: { slack: true, jira: true },
      };
      const db = buildMockDb([
        [{ preferences: JSON.stringify(prefs) }],
      ]);

      const result = await isNotificationEnabled(
        db as any,
        'workspace-1',
        'approval_requested' as EventType,
        'slack',
      );
      expect(result).toBe(true);
    });
  });
});
