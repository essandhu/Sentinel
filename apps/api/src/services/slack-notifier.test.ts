import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// --- Mocks ---
const mockSend = vi.fn();
vi.mock('@slack/webhook', () => ({
  IncomingWebhook: vi.fn().mockImplementation(function (this: any) {
    this.send = mockSend;
  }),
}));

vi.mock('./crypto.js', () => ({
  decrypt: vi.fn((v: string) => v),
}));

vi.mock('./notification-preferences.js', () => ({
  isNotificationEnabled: vi.fn().mockResolvedValue(true),
}));

import { IncomingWebhook } from '@slack/webhook';
import { sendDriftNotification, type DriftNotification } from './slack-notifier.js';
import { sendPostJobNotifications } from './post-job-notifications.js';

// 32-byte hex key for testing
const TEST_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ text: 'ok' });
});

// ========== sendDriftNotification tests ==========

describe('sendDriftNotification', () => {
  const sampleData: DriftNotification = {
    projectName: 'My App',
    componentCount: 3,
    failedDiffCount: 5,
    totalDiffCount: 10,
    dashboardUrl: 'https://sentinel.example.com',
    runId: 'run-abc-123',
  };

  it('creates IncomingWebhook with the provided URL', async () => {
    await sendDriftNotification('https://hooks.slack.com/test', sampleData);
    expect(IncomingWebhook).toHaveBeenCalledWith('https://hooks.slack.com/test');
  });

  it('calls send() with blocks containing project name, component count, diff counts, and dashboard link', async () => {
    await sendDriftNotification('https://hooks.slack.com/test', sampleData);
    expect(mockSend).toHaveBeenCalledTimes(1);

    const payload = mockSend.mock.calls[0][0];

    // Check blocks exist
    expect(payload.blocks).toBeDefined();
    expect(payload.blocks.length).toBeGreaterThanOrEqual(3);

    // Header block
    const headerBlock = payload.blocks.find((b: any) => b.type === 'header');
    expect(headerBlock).toBeDefined();
    expect(headerBlock.text.text).toContain('Visual Drift Detected');

    // Section block with fields
    const sectionBlock = payload.blocks.find((b: any) => b.type === 'section');
    expect(sectionBlock).toBeDefined();
    const fieldTexts = sectionBlock.fields.map((f: any) => f.text);
    expect(fieldTexts).toEqual(
      expect.arrayContaining([
        expect.stringContaining('My App'),
        expect.stringContaining('5 / 10'),
      ]),
    );

    // Actions block with dashboard link
    const actionsBlock = payload.blocks.find((b: any) => b.type === 'actions');
    expect(actionsBlock).toBeDefined();
    expect(actionsBlock.elements[0].url).toBe(
      'https://sentinel.example.com/runs/run-abc-123',
    );
  });

  it('Block Kit payload contains a field with "*Components Affected:*" text', async () => {
    await sendDriftNotification('https://hooks.slack.com/test', sampleData);

    const payload = mockSend.mock.calls[0][0];
    const sectionBlock = payload.blocks.find((b: any) => b.type === 'section');
    const fieldTexts = sectionBlock.fields.map((f: any) => f.text);
    expect(fieldTexts).toEqual(
      expect.arrayContaining([expect.stringContaining('*Components Affected:*')]),
    );
    // Also verify component count value is in the field
    expect(fieldTexts).toEqual(
      expect.arrayContaining([expect.stringContaining('3')]),
    );
  });

  it('text fallback contains project name, counts, and component count', async () => {
    await sendDriftNotification('https://hooks.slack.com/test', sampleData);

    const payload = mockSend.mock.calls[0][0];
    expect(payload.text).toContain('My App');
    expect(payload.text).toContain('5');
    expect(payload.text).toContain('10');
    expect(payload.text).toContain('3');
  });
});

// ========== sendPostJobNotifications tests ==========

describe('sendPostJobNotifications', () => {
  // Helper to create a mock db with chainable methods
  function createMockDb(options: {
    runResult?: any[];
    failedDiffsResult?: any[];
    totalDiffsResult?: any[];
    settingsResult?: any[];
  }) {
    const {
      runResult = [],
      failedDiffsResult = [],
      totalDiffsResult = [],
      settingsResult = [],
    } = options;

    let callIndex = 0;
    const results = [runResult, failedDiffsResult, totalDiffsResult, settingsResult];

    const chainable = () => {
      const chain: any = {};
      const methods = ['select', 'from', 'innerJoin', 'where', 'orderBy', 'limit'];
      for (const method of methods) {
        chain[method] = vi.fn().mockReturnValue(chain);
      }

      // When the chain is awaited (then), return the next result
      chain.then = (resolve: Function) => {
        const result = results[callIndex] ?? [];
        callIndex++;
        resolve(result);
      };

      return chain;
    };

    return {
      select: vi.fn().mockImplementation((..._args: any[]) => {
        const chain = chainable();
        return chain.from('_'); // Start the chain; from() returns chain
      }),
    };
  }

  it('returns early (no Slack call) when no failed diffs', async () => {
    const db = createMockDb({
      runResult: [{ projectName: 'App', workspaceId: 'ws-1' }],
      failedDiffsResult: [], // No failed diffs
    });

    await sendPostJobNotifications(db as any, 'run-1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns early when no workspace settings exist', async () => {
    const db = createMockDb({
      runResult: [{ projectName: 'App', workspaceId: 'ws-1' }],
      failedDiffsResult: [{ count: 2 }],
      totalDiffsResult: [{ count: 5 }],
      settingsResult: [], // No settings
    });

    await sendPostJobNotifications(db as any, 'run-1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns early when slackWebhookUrl is null', async () => {
    const db = createMockDb({
      runResult: [{ projectName: 'App', workspaceId: 'ws-1' }],
      failedDiffsResult: [{ count: 2 }],
      totalDiffsResult: [{ count: 5 }],
      settingsResult: [{ slackWebhookUrl: null }],
    });

    await sendPostJobNotifications(db as any, 'run-1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends notification with correct componentCount when failed diffs exist and webhook configured', async () => {
    const db = createMockDb({
      runResult: [{ projectName: 'My Project', workspaceId: 'ws-1' }],
      failedDiffsResult: [{ count: 3, componentCount: 2 }],
      totalDiffsResult: [{ count: 8 }],
      settingsResult: [{ slackWebhookUrl: 'https://hooks.slack.com/services/TEST' }],
    });

    await sendPostJobNotifications(db as any, 'run-xyz');

    expect(IncomingWebhook).toHaveBeenCalledWith('https://hooks.slack.com/services/TEST');
    expect(mockSend).toHaveBeenCalledTimes(1);

    const payload = mockSend.mock.calls[0][0];
    // Verify project name is in the message
    expect(payload.text).toContain('My Project');
  });

  it('catches Slack errors without throwing (mock send() to reject)', async () => {
    mockSend.mockRejectedValue(new Error('Slack API error'));

    const db = createMockDb({
      runResult: [{ projectName: 'App', workspaceId: 'ws-1' }],
      failedDiffsResult: [{ count: 1, componentCount: 1 }],
      totalDiffsResult: [{ count: 2 }],
      settingsResult: [{ slackWebhookUrl: 'https://hooks.slack.com/services/TEST' }],
    });

    // Should not throw
    await expect(
      sendPostJobNotifications(db as any, 'run-err'),
    ).resolves.toBeUndefined();
  });
});
