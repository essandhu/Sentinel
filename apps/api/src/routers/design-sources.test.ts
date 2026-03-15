import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRegisterFigmaWebhook = vi.hoisted(() => vi.fn());
const mockDeleteFigmaWebhook = vi.hoisted(() => vi.fn());
const mockValidatePenpotConnection = vi.hoisted(() => vi.fn());
const mockEncrypt = vi.hoisted(() => vi.fn());
const mockDecrypt = vi.hoisted(() => vi.fn());
const mockRandomBytes = vi.hoisted(() => vi.fn());
const mockPenpotLoadAll = vi.hoisted(() => vi.fn());
const mockWriteDesignBaselines = vi.hoisted(() => vi.fn());
const mockCreateStorageClient = vi.hoisted(() => vi.fn());

vi.mock('@sentinel/adapters', () => ({
  registerFigmaWebhook: mockRegisterFigmaWebhook,
  deleteFigmaWebhook: mockDeleteFigmaWebhook,
  validatePenpotConnection: mockValidatePenpotConnection,
  verifyFigmaWebhook: vi.fn(),
  FigmaRateLimitError: class extends Error {},
  isRateLimited: vi.fn(),
  persistRateLimit: vi.fn(),
  FigmaAdapter: vi.fn(),
  ImageBaselineAdapter: vi.fn(),
  StorybookAdapter: vi.fn(),
  storybookStoryUrl: vi.fn(),
  DesignTokenAdapter: vi.fn(),
  normalizeColorToHex: vi.fn(),
  SketchAdapter: vi.fn(),
  PenpotAdapter: class { name = 'penpot'; loadAll = mockPenpotLoadAll; },
  extractDesignTokens: vi.fn(),
  FigmaApiError: class extends Error {},
}));

// Mock @sentinel/db before importing routers
vi.mock('@sentinel/db', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
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
      figmaAccessToken: 'workspaceSettings.figmaAccessToken',
      figmaFileKey: 'workspaceSettings.figmaFileKey',
      figmaWebhookId: 'workspaceSettings.figmaWebhookId',
      figmaWebhookPasscode: 'workspaceSettings.figmaWebhookPasscode',
      penpotInstanceUrl: 'workspaceSettings.penpotInstanceUrl',
      penpotAccessToken: 'workspaceSettings.penpotAccessToken',
      updatedAt: 'workspaceSettings.updatedAt',
    },
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

vi.mock('../services/crypto.js', () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
}));

vi.mock('../services/baseline-writer.js', () => ({
  writeDesignBaselines: mockWriteDesignBaselines,
}));

vi.mock('@sentinel/storage', () => ({
  createStorageClient: mockCreateStorageClient,
  uploadBuffer: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  randomBytes: mockRandomBytes,
}));

describe('design-sources router', () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createDb } = await import('@sentinel/db');
    mockDb = (createDb as ReturnType<typeof vi.fn>)();
    mockEncrypt.mockImplementation((val: string) => `enc:${val}`);
    mockDecrypt.mockImplementation((val: string) => val.replace('enc:', ''));
  });

  describe('designSources.status', () => {
    it('returns connection status based on workspace settings', async () => {
      const mockRow = {
        figmaAccessToken: 'enc:tok',
        figmaFileKey: 'fk-123',
        penpotInstanceUrl: null,
        penpotAccessToken: null,
      };

      const mockWhere = vi.fn().mockResolvedValue([mockRow]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.designSources.status();
      expect(result).toEqual({
        figma: { connected: true, fileKey: 'fk-123' },
        penpot: { connected: false, instanceUrl: null },
        zeroheight: { connected: false, orgUrl: null },
      });
    });

    it('returns both disconnected when no settings row exists', async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.designSources.status();
      expect(result).toEqual({
        figma: { connected: false, fileKey: null },
        penpot: { connected: false, instanceUrl: null },
        zeroheight: { connected: false, orgUrl: null },
      });
    });
  });

  describe('designSources.connectFigma', () => {
    it('registers webhook, encrypts credentials, and upserts settings', async () => {
      mockRandomBytes.mockReturnValue({
        toString: () => 'deterministic-passcode-hex',
      });

      mockRegisterFigmaWebhook.mockResolvedValue({ id: 'wh-abc', status: 'ACTIVE' });

      const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      const result = await caller.designSources.connectFigma({
        accessToken: 'figma-pat-123',
        fileKey: 'fk-456',
        webhookEndpointUrl: 'https://sentinel.example.com/webhooks/figma',
      });

      expect(result).toEqual({ success: true, webhookId: 'wh-abc' });

      // Verify registerFigmaWebhook called with correct args
      expect(mockRegisterFigmaWebhook).toHaveBeenCalledWith(
        'figma-pat-123',
        'fk-456',
        'https://sentinel.example.com/webhooks/figma',
        'deterministic-passcode-hex',
      );

      // Verify encrypt was called for token and passcode
      expect(mockEncrypt).toHaveBeenCalledWith('figma-pat-123');
      expect(mockEncrypt).toHaveBeenCalledWith('deterministic-passcode-hex');
    });

    it('rejects when registerFigmaWebhook throws', async () => {
      mockRandomBytes.mockReturnValue({
        toString: () => 'deterministic-passcode-hex',
      });

      mockRegisterFigmaWebhook.mockRejectedValue(
        new Error('Figma webhook registration failed: 400'),
      );

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      await expect(
        caller.designSources.connectFigma({
          accessToken: 'bad-token',
          fileKey: 'fk-456',
          webhookEndpointUrl: 'https://sentinel.example.com/webhooks/figma',
        }),
      ).rejects.toThrow();
    });
  });

  describe('designSources.disconnectFigma', () => {
    it('deletes webhook and clears figma columns', async () => {
      const mockRow = {
        figmaAccessToken: 'enc:tok-abc',
        figmaWebhookId: 'wh-789',
        figmaWebhookPasscode: 'enc:passcode',
        figmaFileKey: 'fk-123',
      };

      const mockWhere = vi.fn().mockResolvedValue([mockRow]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      mockDeleteFigmaWebhook.mockResolvedValue(undefined);

      // Mock the update chain for clearing fields
      const mockUpdateWhere = vi.fn().mockResolvedValue([]);
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      mockDb.update.mockReturnValue({ set: mockSet });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      const result = await caller.designSources.disconnectFigma();
      expect(result).toEqual({ success: true });

      expect(mockDeleteFigmaWebhook).toHaveBeenCalledWith('tok-abc', 'wh-789');
    });

    it('skips deleteFigmaWebhook when no webhookId exists', async () => {
      const mockRow = {
        figmaAccessToken: 'enc:tok',
        figmaWebhookId: null,
        figmaWebhookPasscode: null,
        figmaFileKey: 'fk-123',
      };

      const mockWhere = vi.fn().mockResolvedValue([mockRow]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const mockUpdateWhere = vi.fn().mockResolvedValue([]);
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      mockDb.update.mockReturnValue({ set: mockSet });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      const result = await caller.designSources.disconnectFigma();
      expect(result).toEqual({ success: true });
      expect(mockDeleteFigmaWebhook).not.toHaveBeenCalled();
    });
  });

  describe('designSources.connectPenpot', () => {
    it('validates connection and stores encrypted credentials', async () => {
      mockValidatePenpotConnection.mockResolvedValue({
        id: 'user-penpot-1',
        fullname: 'Test User',
        email: 'test@example.com',
      });

      const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      const result = await caller.designSources.connectPenpot({
        instanceUrl: 'https://penpot.example.com',
        accessToken: 'penpot-tok-123',
      });

      expect(result).toEqual({ success: true });
      expect(mockValidatePenpotConnection).toHaveBeenCalledWith(
        'https://penpot.example.com',
        'penpot-tok-123',
      );
      expect(mockEncrypt).toHaveBeenCalledWith('penpot-tok-123');
    });

    it('rejects when validatePenpotConnection throws', async () => {
      mockValidatePenpotConnection.mockRejectedValue(
        new Error('Penpot RPC get-profile failed: 401'),
      );

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      await expect(
        caller.designSources.connectPenpot({
          instanceUrl: 'https://penpot.example.com',
          accessToken: 'bad-token',
        }),
      ).rejects.toThrow();
    });
  });

  describe('designSources.disconnectPenpot', () => {
    it('clears penpot columns via update', async () => {
      const mockUpdateWhere = vi.fn().mockResolvedValue([]);
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      mockDb.update.mockReturnValue({ set: mockSet });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      const result = await caller.designSources.disconnectPenpot();
      expect(result).toEqual({ success: true });

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('designSources.exportPenpot', () => {
    it('reads encrypted credentials, decrypts, calls PenpotAdapter.loadAll', async () => {
      // Mock workspace settings query to return Penpot credentials
      const mockRow = {
        penpotInstanceUrl: 'https://penpot.example.com',
        penpotAccessToken: 'enc:penpot-secret-token',
      };
      const mockWhere = vi.fn().mockResolvedValue([mockRow]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const mockSpecs = [
        {
          sourceType: 'penpot' as const,
          referenceImage: Buffer.from('img'),
          tokens: {},
          metadata: { componentName: 'Header', penpotComponentId: 'comp-1' },
        },
      ];
      mockPenpotLoadAll.mockResolvedValue(mockSpecs);
      mockWriteDesignBaselines.mockResolvedValue({ baselineCount: 1 });
      mockCreateStorageClient.mockReturnValue({});

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' },
      } as any);

      await caller.designSources.exportPenpot({
        fileId: 'file-abc',
        projectId: '00000000-0000-4000-a000-000000000001',
      });

      expect(mockDecrypt).toHaveBeenCalledWith('enc:penpot-secret-token');
      expect(mockPenpotLoadAll).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceUrl: 'https://penpot.example.com',
          accessToken: 'penpot-secret-token',
          fileId: 'file-abc',
        }),
      );
    });

    it('writes resulting specs to baselines via writeDesignBaselines', async () => {
      const mockRow = {
        penpotInstanceUrl: 'https://penpot.example.com',
        penpotAccessToken: 'enc:tok',
      };
      const mockWhere = vi.fn().mockResolvedValue([mockRow]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const mockSpecs = [
        {
          sourceType: 'penpot' as const,
          referenceImage: Buffer.from('img'),
          tokens: {},
          metadata: { componentName: 'Card' },
        },
      ];
      mockPenpotLoadAll.mockResolvedValue(mockSpecs);
      mockWriteDesignBaselines.mockResolvedValue({ baselineCount: 1 });
      mockCreateStorageClient.mockReturnValue({});

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' },
      } as any);

      await caller.designSources.exportPenpot({
        fileId: 'file-abc',
        projectId: '00000000-0000-4000-a000-000000000001',
      });

      expect(mockWriteDesignBaselines).toHaveBeenCalledWith(
        mockSpecs,
        '00000000-0000-4000-a000-000000000001',
        'user-1',
        expect.anything(), // storageClient
        expect.any(String), // bucket
        expect.anything(), // db
      );
    });

    it('returns baselineCount on success', async () => {
      const mockRow = {
        penpotInstanceUrl: 'https://penpot.example.com',
        penpotAccessToken: 'enc:tok',
      };
      const mockWhere = vi.fn().mockResolvedValue([mockRow]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      mockPenpotLoadAll.mockResolvedValue([]);
      mockWriteDesignBaselines.mockResolvedValue({ baselineCount: 3 });
      mockCreateStorageClient.mockReturnValue({});

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' },
      } as any);

      const result = await caller.designSources.exportPenpot({
        fileId: 'file-abc',
        projectId: '00000000-0000-4000-a000-000000000001',
      });

      expect(result).toEqual({ success: true, baselineCount: 3 });
    });

    it('throws PRECONDITION_FAILED when Penpot credentials are missing', async () => {
      const mockRow = {
        penpotInstanceUrl: null,
        penpotAccessToken: null,
      };
      const mockWhere = vi.fn().mockResolvedValue([mockRow]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const { appRouter } = await import('./index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' },
      } as any);

      await expect(
        caller.designSources.exportPenpot({
          fileId: 'file-abc',
          projectId: '00000000-0000-4000-a000-000000000001',
        }),
      ).rejects.toThrow(/Penpot not connected/);
    });
  });
});
