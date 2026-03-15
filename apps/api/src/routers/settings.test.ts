import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock crypto service before importing routers
vi.mock('../services/crypto.js', () => ({
  encrypt: vi.fn((val: string) => `encrypted:${val}`),
}));

// Mock @sentinel/db before importing routers
vi.mock('@sentinel/db', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
  };
  return {
    createDb: vi.fn(() => mockDb),
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
    // Include other tables required by the appRouter imports
    projects: { id: 'projects.id', workspaceId: 'projects.workspaceId', name: 'projects.name', createdAt: 'projects.createdAt' },
    captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId', createdAt: 'captureRuns.createdAt' },
    snapshots: { id: 'snapshots.id', runId: 'snapshots.runId', s3Key: 'snapshots.s3Key', url: 'snapshots.url', viewport: 'snapshots.viewport' },
    diffReports: { id: 'diffReports.id', snapshotId: 'diffReports.snapshotId', baselineS3Key: 'diffReports.baselineS3Key', diffS3Key: 'diffReports.diffS3Key', pixelDiffPercent: 'diffReports.pixelDiffPercent', ssimScore: 'diffReports.ssimScore', passed: 'diffReports.passed', createdAt: 'diffReports.createdAt' },
    baselines: { id: 'baselines.id', projectId: 'baselines.projectId', url: 'baselines.url', viewport: 'baselines.viewport', s3Key: 'baselines.s3Key', snapshotId: 'baselines.snapshotId', approvedBy: 'baselines.approvedBy', createdAt: 'baselines.createdAt' },
    approvalDecisions: { id: 'approvalDecisions.id', diffReportId: 'approvalDecisions.diffReportId', action: 'approvalDecisions.action', userId: 'approvalDecisions.userId', userEmail: 'approvalDecisions.userEmail', reason: 'approvalDecisions.reason', createdAt: 'approvalDecisions.createdAt' },
  };
});

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  count: vi.fn((col) => ({ _type: 'count', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
}));

describe('settings router', () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createDb } = await import('@sentinel/db');
    mockDb = (createDb as ReturnType<typeof vi.fn>)();
  });

  describe('settings.get', () => {
    it('returns null when no settings exist for workspace', async () => {
      // Mock select chain: select().from().where() => []
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.settings.get();
      expect(result).toBeNull();
    });

    it('returns settings with secrets masked when they exist', async () => {
      const mockRow = {
        id: 'set-1',
        workspaceId: 'org-1',
        slackWebhookUrl: 'encrypted:https://hooks.slack.com/xxx',
        jiraHost: 'mycompany.atlassian.net',
        jiraEmail: 'bot@mycompany.com',
        jiraApiToken: 'encrypted:token123',
        jiraProjectKey: 'SENT',
        updatedAt: new Date('2026-03-04'),
      };

      const mockWhere = vi.fn().mockResolvedValue([mockRow]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.settings.get();

      expect(result).not.toBeNull();
      expect(result!.slackWebhookUrl).toBe('***configured***');
      expect(result!.jiraApiToken).toBe('***configured***');
      expect(result!.jiraHost).toBe('mycompany.atlassian.net');
      expect(result!.jiraEmail).toBe('bot@mycompany.com');
      expect(result!.jiraProjectKey).toBe('SENT');
    });

    it('returns null for secrets that are not configured', async () => {
      const mockRow = {
        id: 'set-1',
        workspaceId: 'org-1',
        slackWebhookUrl: null,
        jiraHost: null,
        jiraEmail: null,
        jiraApiToken: null,
        jiraProjectKey: null,
        updatedAt: new Date('2026-03-04'),
      };

      const mockWhere = vi.fn().mockResolvedValue([mockRow]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.settings.get();

      expect(result).not.toBeNull();
      expect(result!.slackWebhookUrl).toBeNull();
      expect(result!.jiraApiToken).toBeNull();
    });
  });

  describe('settings.update', () => {
    it('encrypts slackWebhookUrl before storage', async () => {
      const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([{ id: 'set-1' }]);
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      const result = await caller.settings.update({
        slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
      });

      expect(result).toEqual({ success: true });

      // Verify encrypt was called with the webhook URL
      const { encrypt } = await import('../services/crypto.js');
      expect(encrypt).toHaveBeenCalledWith('https://hooks.slack.com/services/T00/B00/xxx');
    });

    it('encrypts jiraApiToken before storage', async () => {
      const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([{ id: 'set-1' }]);
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      const result = await caller.settings.update({
        jiraApiToken: 'my-secret-token',
        jiraHost: 'mycompany.atlassian.net',
        jiraEmail: 'bot@company.com',
      });

      expect(result).toEqual({ success: true });

      const { encrypt } = await import('../services/crypto.js');
      expect(encrypt).toHaveBeenCalledWith('my-secret-token');
    });

    it('uses upsert (insert with onConflictDoUpdate)', async () => {
      const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([{ id: 'set-1' }]);
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      await caller.settings.update({
        jiraProjectKey: 'SENT',
      });

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledTimes(1);
      expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
    });

    it('rejects non-admin caller with FORBIDDEN', async () => {
      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-2', orgId: 'org-1', orgRole: 'org:viewer' },
      } as any);

      await expect(
        caller.settings.update({
          slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
        }),
      ).rejects.toThrow('Admin role required');
    });

    it('rejects org:member caller with FORBIDDEN', async () => {
      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-3', orgId: 'org-1', orgRole: 'org:member' },
      } as any);

      await expect(
        caller.settings.update({
          slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
        }),
      ).rejects.toThrow('Admin role required');
    });
  });

  describe('procedure enforcement', () => {
    it('settings.get uses workspaceProcedure (viewers can read)', async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:viewer' },
      } as any);

      // Should NOT throw - viewers can read settings status
      const result = await caller.settings.get();
      expect(result).toBeNull();
    });
  });
});
