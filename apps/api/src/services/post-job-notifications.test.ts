import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Test UUIDs ----------
const RUN_ID = '00000000-0000-4000-a000-000000000300';
const WS_ID = 'ws_test_workspace';

// ---------- Chainable mock DB ----------
function buildMockDb(selectResponses: unknown[][] = []) {
  let selectCallIdx = 0;

  const makeSelectChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.leftJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.groupBy = vi.fn(() => chain);
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(fn);
    return chain;
  };

  return {
    select: vi.fn((..._args: unknown[]) => {
      const response = selectResponses[selectCallIdx] ?? [];
      selectCallIdx++;
      return makeSelectChain(response);
    }),
  };
}

// Mock @sentinel/db
vi.mock('@sentinel/db', () => ({
  createDb: vi.fn(() => ({})),
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.projectId',
  },
  projects: {
    id: 'projects.id',
    name: 'projects.name',
    workspaceId: 'projects.workspaceId',
  },
  snapshots: {
    id: 'snapshots.id',
    runId: 'snapshots.runId',
    url: 'snapshots.url',
  },
  diffReports: {
    id: 'diffReports.id',
    snapshotId: 'diffReports.snapshotId',
    passed: 'diffReports.passed',
  },
  workspaceSettings: {
    workspaceId: 'workspaceSettings.workspaceId',
    slackWebhookUrl: 'workspaceSettings.slackWebhookUrl',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  sql: vi.fn(),
}));

const mockDecrypt = vi.fn((v: string) => `decrypted:${v}`);
vi.mock('./crypto.js', () => ({
  decrypt: (...args: any[]) => mockDecrypt(...args),
}));

const mockSendDriftNotification = vi.fn();
vi.mock('./slack-notifier.js', () => ({
  sendDriftNotification: (...args: any[]) => mockSendDriftNotification(...args),
}));

const mockIsNotificationEnabled = vi.fn();
vi.mock('./notification-preferences.js', () => ({
  isNotificationEnabled: (...args: any[]) => mockIsNotificationEnabled(...args),
}));

import { sendPostJobNotifications } from './post-job-notifications.js';

describe('sendPostJobNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsNotificationEnabled.mockResolvedValue(true);
  });

  it('sends Slack notification when failed diffs exist and webhook configured', async () => {
    const db = buildMockDb([
      // Step 1: run with project info
      [{ projectName: 'My Project', workspaceId: WS_ID }],
      // Step 2: failed diffs count
      [{ count: 3, componentCount: 2 }],
      // Step 3: total diffs count
      [{ count: 10 }],
      // Step 4: workspace settings with webhook
      [{ slackWebhookUrl: 'https://hooks.slack.com/xxx' }],
    ]);

    await sendPostJobNotifications(db as any, RUN_ID);

    expect(mockDecrypt).toHaveBeenCalledWith('https://hooks.slack.com/xxx');
    expect(mockSendDriftNotification).toHaveBeenCalledWith(
      'decrypted:https://hooks.slack.com/xxx',
      expect.objectContaining({
        projectName: 'My Project',
        failedDiffCount: 3,
        totalDiffCount: 10,
        componentCount: 2,
        runId: RUN_ID,
      }),
    );
  });

  it('does nothing when run not found', async () => {
    const db = buildMockDb([
      // Step 1: no run found
      [],
    ]);

    await sendPostJobNotifications(db as any, RUN_ID);

    expect(mockSendDriftNotification).not.toHaveBeenCalled();
  });

  it('does nothing when no failed diffs', async () => {
    const db = buildMockDb([
      // Step 1: run found
      [{ projectName: 'My Project', workspaceId: WS_ID }],
      // Step 2: zero failed diffs
      [{ count: 0, componentCount: 0 }],
    ]);

    await sendPostJobNotifications(db as any, RUN_ID);

    expect(mockSendDriftNotification).not.toHaveBeenCalled();
  });

  it('does nothing when no webhook configured', async () => {
    const db = buildMockDb([
      // Step 1: run found
      [{ projectName: 'My Project', workspaceId: WS_ID }],
      // Step 2: failed diffs exist
      [{ count: 5, componentCount: 3 }],
      // Step 3: total diffs
      [{ count: 10 }],
      // Step 4: no webhook
      [{ slackWebhookUrl: null }],
    ]);

    await sendPostJobNotifications(db as any, RUN_ID);

    expect(mockSendDriftNotification).not.toHaveBeenCalled();
  });

  it('does nothing when notifications disabled', async () => {
    mockIsNotificationEnabled.mockResolvedValue(false);

    const db = buildMockDb([
      // Step 1: run found
      [{ projectName: 'My Project', workspaceId: WS_ID }],
      // Step 2: failed diffs exist
      [{ count: 5, componentCount: 3 }],
      // Step 3: total diffs
      [{ count: 10 }],
      // Step 4: webhook configured
      [{ slackWebhookUrl: 'https://hooks.slack.com/xxx' }],
    ]);

    await sendPostJobNotifications(db as any, RUN_ID);

    expect(mockSendDriftNotification).not.toHaveBeenCalled();
  });

  it('catches and logs errors without throwing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = buildMockDb([]);
    // Make the first select throw
    (db.select as any).mockImplementation(() => {
      throw new Error('DB connection failed');
    });

    // Should not throw
    await expect(sendPostJobNotifications(db as any, RUN_ID)).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[notification]'),
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});
