import { describe, it, expect, vi } from 'vitest';

// Mock all external dependencies that routers import at module level

vi.mock('@sentinel-vrt/db', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  };
  return {
    createDb: vi.fn(() => mockDb),
    projects: { id: 'projects.id', workspaceId: 'projects.workspaceId', name: 'projects.name', createdAt: 'projects.createdAt' },
    captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId', createdAt: 'captureRuns.createdAt', branchName: 'captureRuns.branchName', commitSha: 'captureRuns.commitSha', status: 'captureRuns.status' },
    snapshots: { id: 'snapshots.id', runId: 'snapshots.runId', s3Key: 'snapshots.s3Key', url: 'snapshots.url', viewport: 'snapshots.viewport', browser: 'snapshots.browser', parameterName: 'snapshots.parameterName' },
    diffReports: { id: 'diffReports.id', snapshotId: 'diffReports.snapshotId', baselineS3Key: 'diffReports.baselineS3Key', diffS3Key: 'diffReports.diffS3Key', pixelDiffPercent: 'diffReports.pixelDiffPercent', ssimScore: 'diffReports.ssimScore', passed: 'diffReports.passed', createdAt: 'diffReports.createdAt' },
    baselines: { id: 'baselines.id', projectId: 'baselines.projectId', url: 'baselines.url', viewport: 'baselines.viewport', s3Key: 'baselines.s3Key', snapshotId: 'baselines.snapshotId', approvedBy: 'baselines.approvedBy' },
    approvalDecisions: { id: 'approvalDecisions.id', diffReportId: 'approvalDecisions.diffReportId', action: 'approvalDecisions.action', userId: 'approvalDecisions.userId', userEmail: 'approvalDecisions.userEmail', reason: 'approvalDecisions.reason', jiraIssueKey: 'approvalDecisions.jiraIssueKey', createdAt: 'approvalDecisions.createdAt' },
    workspaceSettings: { id: 'workspaceSettings.id', workspaceId: 'workspaceSettings.workspaceId' },
    components: { id: 'components.id', projectId: 'components.projectId', name: 'components.name' },
    breakpointPresets: { id: 'breakpointPresets.id', projectId: 'breakpointPresets.projectId' },
    captureSchedules: { id: 'captureSchedules.id', projectId: 'captureSchedules.projectId' },
    approvalChainSteps: { id: 'approvalChainSteps.id', projectId: 'approvalChainSteps.projectId' },
    approvalChainProgress: { id: 'approvalChainProgress.id' },
    diffClassifications: { id: 'diffClassifications.id' },
    diffRegions: { id: 'diffRegions.id' },
    layoutShifts: { id: 'layoutShifts.id', $inferSelect: {} },
    classificationOverrides: { id: 'classificationOverrides.id' },
    environments: { id: 'environments.id' },
  };
});

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  asc: vi.fn((col) => ({ _type: 'asc', col })),
  count: vi.fn((col) => ({ _type: 'count', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
  inArray: vi.fn((col, vals) => ({ _type: 'inArray', col, vals })),
}));

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => ({
    organizations: {
      createOrganization: vi.fn(),
      createOrganizationInvitation: vi.fn(),
      updateOrganizationMembership: vi.fn(),
      getOrganizationMembershipList: vi.fn(),
    },
  })),
}));

vi.mock('@sentinel-vrt/storage', () => ({
  createStorageClient: vi.fn(() => ({})),
  downloadBuffer: vi.fn(),
  uploadBuffer: vi.fn(),
}));

vi.mock('@sentinel-vrt/capture', () => ({
  BREAKPOINT_TEMPLATES: { tailwind: [], bootstrap: [] },
  runDualDiff: vi.fn(),
  loadAllPlugins: vi.fn().mockResolvedValue([]),
  PluginHookRunner: vi.fn(),
  loadConfig: vi.fn().mockResolvedValue({ plugins: {} }),
}));

vi.mock('../../services/crypto.js', () => ({
  decrypt: vi.fn((v: string) => v),
  encrypt: vi.fn((v: string) => v),
}));

vi.mock('../../services/jira-service.js', () => ({
  createJiraIssue: vi.fn(),
  attachToJiraIssue: vi.fn(),
}));

vi.mock('../../services/notification-preferences.js', () => ({
  isNotificationEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../ws/websocket-manager.js', () => ({
  wsManager: { broadcast: vi.fn() },
}));

vi.mock('../../services/approval-chain-service.js', () => ({
  getChainForProject: vi.fn().mockResolvedValue([]),
  validateAndRecordApproval: vi.fn().mockResolvedValue({ chainComplete: false }),
  maybePromoteBaseline: vi.fn(),
}));

vi.mock('../../queue.js', () => ({
  getCaptureQueue: vi.fn(() => ({ add: vi.fn().mockResolvedValue({ id: 'job-1' }) })),
}));

vi.mock('../../services/classification-service.js', () => ({
  getClassificationsByRunId: vi.fn().mockResolvedValue([]),
  submitOverride: vi.fn(),
  getLayoutShiftsByDiffReportId: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/diff-service.js', () => ({
  getDiffsByRunId: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/environment-service.js', () => ({
  listEnvironments: vi.fn().mockResolvedValue([]),
  createEnvironment: vi.fn(),
  updateEnvironment: vi.fn(),
  deleteEnvironment: vi.fn(),
}));

vi.mock('../../services/environment-diff.js', () => ({
  computeEnvironmentDiff: vi.fn(),
  listEnvironmentRoutes: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/project-service.js', () => ({
  listProjects: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/schedule-manager.js', () => ({
  ScheduleManager: vi.fn().mockImplementation(function (this: any) {
    this.addSchedule = vi.fn();
    this.removeSchedule = vi.fn();
    this.getNextRun = vi.fn();
    this.reconcileSchedules = vi.fn();
  }),
}));

vi.mock('cron-parser', () => ({
  CronExpressionParser: {
    parse: vi.fn(() => ({ hasNext: () => true })),
  },
}));

vi.mock('cronstrue', () => ({
  default: { toString: vi.fn(() => 'description') },
}));

describe('appRouter (index)', () => {
  it('exports appRouter with all expected sub-routers', async () => {
    const { appRouter } = await import('../../routers/index.js');

    expect(appRouter).toBeDefined();
    // appRouter is a tRPC router - verify it has createCaller
    expect(typeof appRouter.createCaller).toBe('function');
  });

  it('exports AppRouter type (module has named export)', async () => {
    const mod = await import('../../routers/index.js');
    expect(mod).toHaveProperty('appRouter');
    expect(mod).toHaveProperty('t');
  });

  it('all expected router namespaces are callable', async () => {
    const { appRouter } = await import('../../routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    // Verify each namespace exists and is an object with callable procedures
    const expectedNamespaces = [
      'health',
      'runs',
      'diffs',
      'captures',
      'workspaces',
      'approvals',
      'settings',
      'schedules',
      'components',
      'healthScores',
      'designSources',
      'notificationPreferences',
      'apiKeys',
      'a11y',
      'classifications',
      'breakpoints',
      'lighthouse',
      'suites',
      'stability',
      'approvalChains',
      'search',
      'analytics',
      'environments',
      'projects',
    ];

    for (const ns of expectedNamespaces) {
      expect((caller as any)[ns]).toBeDefined();
    }
  });

  it('health.check is accessible through the merged router', async () => {
    const { appRouter } = await import('../../routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.health.check();
    expect(result.status).toBe('ok');
    expect(result).toHaveProperty('timestamp');
  });
});
