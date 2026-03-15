import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock notification-preferences service
vi.mock('../services/notification-preferences.js', () => ({
  DEFAULT_NOTIFICATION_PREFERENCES: {
    drift_detected: { slack: true, jira: true },
    approval_requested: { slack: true, jira: true },
    scheduled_capture_failed: { slack: true, jira: true },
    rejection_created: { slack: true, jira: true },
  },
  isNotificationEnabled: vi.fn(),
}));

// Mock crypto service
vi.mock('../services/crypto.js', () => ({
  encrypt: vi.fn((val: string) => `encrypted:${val}`),
  decrypt: vi.fn((val: string) => val.replace('encrypted:', '')),
}));

// Mock jira-service
vi.mock('../services/jira-service.js', () => ({
  createJiraIssue: vi.fn().mockResolvedValue('SEN-123'),
  attachToJiraIssue: vi.fn().mockResolvedValue(undefined),
}));

// Mock storage
vi.mock('@sentinel/storage', () => ({
  createStorageClient: vi.fn(() => ({})),
  downloadBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
}));

// Mock slack notifier
vi.mock('../services/slack-notifier.js', () => ({
  sendDriftNotification: vi.fn().mockResolvedValue(undefined),
}));

// Mock @sentinel/db
vi.mock('@sentinel/db', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  return {
    createDb: vi.fn(() => mockDb),
    notificationPreferences: {
      id: 'notificationPreferences.id',
      workspaceId: 'notificationPreferences.workspaceId',
      preferences: 'notificationPreferences.preferences',
      updatedAt: 'notificationPreferences.updatedAt',
    },
    workspaceSettings: {
      id: 'workspaceSettings.id',
      workspaceId: 'workspaceSettings.workspaceId',
      slackWebhookUrl: 'workspaceSettings.slackWebhookUrl',
      jiraHost: 'workspaceSettings.jiraHost',
      jiraEmail: 'workspaceSettings.jiraEmail',
      jiraApiToken: 'workspaceSettings.jiraApiToken',
      jiraProjectKey: 'workspaceSettings.jiraProjectKey',
      updatedAt: 'workspaceSettings.updatedAt',
    },
    projects: { id: 'projects.id', workspaceId: 'projects.workspaceId', name: 'projects.name', createdAt: 'projects.createdAt' },
    captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId', createdAt: 'captureRuns.createdAt' },
    snapshots: { id: 'snapshots.id', runId: 'snapshots.runId', s3Key: 'snapshots.s3Key', url: 'snapshots.url', viewport: 'snapshots.viewport' },
    diffReports: { id: 'diffReports.id', snapshotId: 'diffReports.snapshotId', baselineS3Key: 'diffReports.baselineS3Key', diffS3Key: 'diffReports.diffS3Key', pixelDiffPercent: 'diffReports.pixelDiffPercent', ssimScore: 'diffReports.ssimScore', passed: 'diffReports.passed', createdAt: 'diffReports.createdAt' },
    baselines: { id: 'baselines.id', projectId: 'baselines.projectId', url: 'baselines.url', viewport: 'baselines.viewport', s3Key: 'baselines.s3Key', snapshotId: 'baselines.snapshotId', approvedBy: 'baselines.approvedBy', createdAt: 'baselines.createdAt' },
    approvalDecisions: { id: 'approvalDecisions.id', diffReportId: 'approvalDecisions.diffReportId', action: 'approvalDecisions.action', userId: 'approvalDecisions.userId', userEmail: 'approvalDecisions.userEmail', reason: 'approvalDecisions.reason', jiraIssueKey: 'approvalDecisions.jiraIssueKey', createdAt: 'approvalDecisions.createdAt' },
    components: { id: 'components.id', projectId: 'components.projectId' },
    healthScores: { id: 'healthScores.id', projectId: 'healthScores.projectId' },
  };
});

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  count: vi.fn((col) => ({ _type: 'count', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
}));

describe('notification-preferences router', () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createDb } = await import('@sentinel/db');
    mockDb = (createDb as ReturnType<typeof vi.fn>)();
  });

  describe('notificationPreferences.get', () => {
    it('returns DEFAULT_NOTIFICATION_PREFERENCES when no row exists', async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.notificationPreferences.get();
      expect(result).toEqual({
        drift_detected: { slack: true, jira: true },
        approval_requested: { slack: true, jira: true },
        scheduled_capture_failed: { slack: true, jira: true },
        rejection_created: { slack: true, jira: true },
      });
    });

    it('returns stored preferences when row exists', async () => {
      const storedPrefs = {
        drift_detected: { slack: false, jira: true },
        approval_requested: { slack: true, jira: false },
        scheduled_capture_failed: { slack: true, jira: true },
        rejection_created: { slack: true, jira: true },
      };

      const mockWhere = vi.fn().mockResolvedValue([
        { preferences: JSON.stringify(storedPrefs) },
      ]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.notificationPreferences.get();
      expect(result).toEqual(storedPrefs);
    });
  });

  describe('notificationPreferences.update', () => {
    it('upserts preferences (insert or update on conflict)', async () => {
      const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([{ id: 'pref-1' }]);
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      const prefs = {
        drift_detected: { slack: false, jira: true },
        approval_requested: { slack: true, jira: true },
        scheduled_capture_failed: { slack: true, jira: true },
        rejection_created: { slack: true, jira: true },
      };

      const result = await caller.notificationPreferences.update({ preferences: prefs });
      expect(result).toEqual({ success: true });
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
    });

    it('uses adminProcedure (rejects non-admin caller)', async () => {
      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-2', orgId: 'org-1', orgRole: 'org:viewer' },
      } as any);

      await expect(
        caller.notificationPreferences.update({
          preferences: {
            drift_detected: { slack: true, jira: true },
            approval_requested: { slack: true, jira: true },
            scheduled_capture_failed: { slack: true, jira: true },
            rejection_created: { slack: true, jira: true },
          },
        }),
      ).rejects.toThrow('Admin role required');
    });
  });
});
