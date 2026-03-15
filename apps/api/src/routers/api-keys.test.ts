import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api-key-service
vi.mock('../services/api-key-service.js', () => ({
  generateApiKey: vi.fn(() => ({
    rawKey: 'sk_live_testkey123456789',
    keyHash: 'a'.repeat(64),
    keyPrefix: 'sk_live_testke...',
  })),
  hashApiKey: vi.fn(() => 'a'.repeat(64)),
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

// Mock @sentinel/db
vi.mock('@sentinel/db', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  return {
    createDb: vi.fn(() => mockDb),
    apiKeys: {
      id: 'apiKeys.id',
      workspaceId: 'apiKeys.workspaceId',
      name: 'apiKeys.name',
      keyHash: 'apiKeys.keyHash',
      keyPrefix: 'apiKeys.keyPrefix',
      createdBy: 'apiKeys.createdBy',
      revokedAt: 'apiKeys.revokedAt',
      lastUsedAt: 'apiKeys.lastUsedAt',
      createdAt: 'apiKeys.createdAt',
    },
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

describe('api-keys router', () => {
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

  describe('apiKeys.create', () => {
    it('returns rawKey with sk_live_ prefix, keyPrefix, name, id, and createdAt', async () => {
      const now = new Date();
      const mockReturning = vi.fn().mockResolvedValue([
        { id: 'key-1', name: 'My Key', keyPrefix: 'sk_live_testke...', createdAt: now },
      ]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      const result = await caller.apiKeys.create({ name: 'My Key' });

      expect(result.rawKey).toBe('sk_live_testkey123456789');
      expect(result.keyPrefix).toBe('sk_live_testke...');
      expect(result.name).toBe('My Key');
      expect(result.id).toBe('key-1');
      expect(result.createdAt).toEqual(now);
    });

    it('inserts a row with keyHash (never rawKey) into DB', async () => {
      const mockReturning = vi.fn().mockResolvedValue([
        { id: 'key-1', name: 'Test', keyPrefix: 'sk_live_testke...', createdAt: new Date() },
      ]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      await caller.apiKeys.create({ name: 'Test' });

      const insertedValues = mockValues.mock.calls[0][0];
      expect(insertedValues.keyHash).toBe('a'.repeat(64));
      expect(insertedValues).not.toHaveProperty('rawKey');
    });

    it('rejects empty name (zod validation)', async () => {
      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      await expect(caller.apiKeys.create({ name: '' })).rejects.toThrow();
    });

    it('uses adminProcedure (rejects non-admin caller)', async () => {
      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-2', orgId: 'org-1', orgRole: 'org:viewer' },
      } as any);

      await expect(caller.apiKeys.create({ name: 'Test' })).rejects.toThrow('Admin role required');
    });
  });

  describe('apiKeys.list', () => {
    it('returns array of keys with id, name, keyPrefix, createdAt, revokedAt, lastUsedAt -- never keyHash', async () => {
      const now = new Date();
      const mockKeys = [
        { id: 'key-1', name: 'Key 1', keyPrefix: 'sk_live_abc12...', createdAt: now, revokedAt: null, lastUsedAt: null },
        { id: 'key-2', name: 'Key 2', keyPrefix: 'sk_live_def34...', createdAt: now, revokedAt: now, lastUsedAt: now },
      ];
      const mockWhere = vi.fn().mockResolvedValue(mockKeys);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      const result = await caller.apiKeys.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('keyPrefix');
      expect(result[0]).not.toHaveProperty('keyHash');
    });

    it('filters by workspace (workspaceId from ctx)', async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' },
      } as any);

      await caller.apiKeys.list();

      const { eq } = await import('drizzle-orm');
      expect(eq).toHaveBeenCalledWith('apiKeys.workspaceId', 'org-1');
    });
  });

  describe('apiKeys.revoke', () => {
    it('sets revokedAt timestamp and returns success: true', async () => {
      const mockWhere = vi.fn().mockResolvedValue([{ id: 'key-1' }]);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.update.mockReturnValue({ set: mockSet });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      const result = await caller.apiKeys.revoke({ id: '00000000-0000-0000-0000-000000000001' });

      expect(result).toEqual({ success: true });
      const setArg = mockSet.mock.calls[0][0];
      expect(setArg.revokedAt).toBeInstanceOf(Date);
    });

    it('uses adminProcedure (rejects non-admin caller)', async () => {
      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-2', orgId: 'org-1', orgRole: 'org:viewer' },
      } as any);

      await expect(
        caller.apiKeys.revoke({ id: '00000000-0000-0000-0000-000000000001' }),
      ).rejects.toThrow('Admin role required');
    });
  });
});
