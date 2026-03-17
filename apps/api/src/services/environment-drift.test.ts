import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Hoisted mocks ----------
const mockComputeEnvironmentDiff = vi.hoisted(() => vi.fn());
const mockIsNotificationEnabled = vi.hoisted(() => vi.fn());
const mockSendEnvironmentDriftNotification = vi.hoisted(() => vi.fn());

// ---------- Mock modules ----------

vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ op: 'eq', args }),
  and: (...args: any[]) => ({ op: 'and', args }),
}));

vi.mock('@sentinel-vrt/db', () => ({
  environments: {
    projectId: 'environments.projectId',
    isReference: 'environments.isReference',
    name: 'environments.name',
    _: { name: 'environments' },
    [Symbol.for('drizzle:Name')]: 'environments',
  },
  environmentDiffs: {
    projectId: 'environmentDiffs.projectId',
    sourceEnv: 'environmentDiffs.sourceEnv',
    targetEnv: 'environmentDiffs.targetEnv',
    passed: 'environmentDiffs.passed',
    _: { name: 'environment_diffs' },
    [Symbol.for('drizzle:Name')]: 'environment_diffs',
  },
  snapshots: {
    url: 'snapshots.url',
    viewport: 'snapshots.viewport',
    browser: 'snapshots.browser',
    runId: 'snapshots.runId',
    _: { name: 'snapshots' },
    [Symbol.for('drizzle:Name')]: 'snapshots',
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.projectId',
    environmentName: 'captureRuns.environmentName',
    _: { name: 'capture_runs' },
    [Symbol.for('drizzle:Name')]: 'capture_runs',
  },
  projects: {
    id: 'projects.id',
    workspaceId: 'projects.workspaceId',
    name: 'projects.name',
    _: { name: 'projects' },
    [Symbol.for('drizzle:Name')]: 'projects',
  },
  workspaceSettings: {
    workspaceId: 'workspaceSettings.workspaceId',
    slackWebhookUrl: 'workspaceSettings.slackWebhookUrl',
    _: { name: 'workspace_settings' },
    [Symbol.for('drizzle:Name')]: 'workspace_settings',
  },
}));

vi.mock('./environment-diff.js', () => ({
  computeEnvironmentDiff: mockComputeEnvironmentDiff,
}));

vi.mock('./notification-preferences.js', () => ({
  isNotificationEnabled: mockIsNotificationEnabled,
}));

vi.mock('./slack-notifier.js', () => ({
  sendEnvironmentDriftNotification: mockSendEnvironmentDriftNotification,
}));

import { detectEnvironmentDrift } from './environment-drift.js';
import type { EnvironmentDriftNotification } from './slack-notifier.js';

// ---------- helpers ----------

/**
 * Build a mock Drizzle-like db object that returns different data based on
 * which table is queried. Tracks table via the `.from()` call.
 */
function mockDb(overrides: {
  environments?: any[];
  snapshots?: any[];
  environmentDiffs?: any[];
  projects?: any[];
  workspaceSettings?: any[];
} = {}) {
  const envs = overrides.environments ?? [];
  const snaps = overrides.snapshots ?? [];
  const diffs = overrides.environmentDiffs ?? [];
  const projs = overrides.projects ?? [{ workspaceId: 'ws-1', name: 'My Project' }];
  const settings = overrides.workspaceSettings ?? [{ slackWebhookUrl: 'https://hooks.slack.com/test' }];

  function resolveByTable(tableName: string) {
    if (tableName === 'environments') return envs;
    if (tableName === 'environment_diffs') return diffs;
    if (tableName === 'projects') return projs;
    if (tableName === 'workspace_settings') return settings;
    return [];
  }

  function createSelectChain() {
    let tableName = '';
    const chain: any = {};
    chain.from = vi.fn().mockImplementation((table: any) => {
      tableName = table?.[Symbol.for('drizzle:Name')] ?? table?._?.name ?? '';
      return chain;
    });
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockImplementation(() => Promise.resolve(resolveByTable(tableName)));
    return chain;
  }

  const db: any = {
    select: vi.fn().mockImplementation(() => createSelectChain()),
    selectDistinct: vi.fn().mockImplementation(() => {
      const chain: any = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockResolvedValue(snaps);
      return chain;
    }),
  };

  return db;
}

const mockStorage: any = {};
const bucket = 'test-bucket';

describe('detectEnvironmentDrift', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsNotificationEnabled.mockResolvedValue(true);
    mockSendEnvironmentDriftNotification.mockResolvedValue(undefined);
  });

  it('skips if capture has no environmentName', async () => {
    const db = mockDb();
    await detectEnvironmentDrift(db, mockStorage, bucket, {
      captureRunId: 'run-1',
      environmentName: null as any,
      projectId: 'proj-1',
    });

    expect(db.select).not.toHaveBeenCalled();
  });

  it('skips if no reference environment is defined for the project', async () => {
    const db = mockDb({ environments: [] });
    await detectEnvironmentDrift(db, mockStorage, bucket, {
      captureRunId: 'run-1',
      environmentName: 'staging',
      projectId: 'proj-1',
    });

    expect(mockComputeEnvironmentDiff).not.toHaveBeenCalled();
  });

  it('skips if capture IS the reference environment (no self-comparison)', async () => {
    const db = mockDb({
      environments: [{ id: 'env-1', name: 'production', isReference: 1 }],
    });
    await detectEnvironmentDrift(db, mockStorage, bucket, {
      captureRunId: 'run-1',
      environmentName: 'production',
      projectId: 'proj-1',
    });

    expect(mockComputeEnvironmentDiff).not.toHaveBeenCalled();
  });

  it('compares each route against the reference environment', async () => {
    const routes = [
      { url: '/home', viewport: '1920x1080', browser: 'chromium' },
      { url: '/about', viewport: '1920x1080', browser: 'chromium' },
    ];
    const db = mockDb({
      environments: [{ id: 'env-1', name: 'production', isReference: 1 }],
      snapshots: routes,
      environmentDiffs: [],
    });

    mockComputeEnvironmentDiff.mockResolvedValue({
      status: 'computed',
      diff: { passed: true, pixelDiffPercent: 0, ssimScore: 10000 },
    });

    await detectEnvironmentDrift(db, mockStorage, bucket, {
      captureRunId: 'run-1',
      environmentName: 'staging',
      projectId: 'proj-1',
    });

    expect(mockComputeEnvironmentDiff).toHaveBeenCalledTimes(2);
    expect(mockComputeEnvironmentDiff).toHaveBeenCalledWith(
      db, mockStorage, bucket,
      expect.objectContaining({
        projectId: 'proj-1',
        sourceEnv: 'staging',
        targetEnv: 'production',
        url: '/home',
      }),
    );
  });

  it('sends drift alert when routes fail AND previous state was passing', async () => {
    const routes = [
      { url: '/home', viewport: '1920x1080', browser: 'chromium' },
    ];
    const db = mockDb({
      environments: [{ id: 'env-1', name: 'production', isReference: 1 }],
      snapshots: routes,
      environmentDiffs: [{ passed: 'true' }],
      projects: [{ workspaceId: 'ws-1', name: 'My Project' }],
      workspaceSettings: [{ slackWebhookUrl: 'https://hooks.slack.com/test' }],
    });

    mockComputeEnvironmentDiff.mockResolvedValue({
      status: 'computed',
      diff: { passed: false, pixelDiffPercent: 500, ssimScore: 8000 },
    });

    await detectEnvironmentDrift(db, mockStorage, bucket, {
      captureRunId: 'run-1',
      environmentName: 'staging',
      projectId: 'proj-1',
    });

    expect(mockSendEnvironmentDriftNotification).toHaveBeenCalledTimes(1);
    expect(mockSendEnvironmentDriftNotification).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        projectName: 'My Project',
        sourceEnv: 'staging',
        targetEnv: 'production',
        failedRouteCount: 1,
        totalRouteCount: 1,
      }),
    );
  });

  it('does NOT send alert when drift status has not changed (was already failing)', async () => {
    const routes = [
      { url: '/home', viewport: '1920x1080', browser: 'chromium' },
    ];
    const db = mockDb({
      environments: [{ id: 'env-1', name: 'production', isReference: 1 }],
      snapshots: routes,
      environmentDiffs: [{ passed: 'false' }],
    });

    mockComputeEnvironmentDiff.mockResolvedValue({
      status: 'computed',
      diff: { passed: false, pixelDiffPercent: 500, ssimScore: 8000 },
    });

    await detectEnvironmentDrift(db, mockStorage, bucket, {
      captureRunId: 'run-1',
      environmentName: 'staging',
      projectId: 'proj-1',
    });

    expect(mockSendEnvironmentDriftNotification).not.toHaveBeenCalled();
  });

  it('respects notification preferences (environment_drift disabled)', async () => {
    const routes = [
      { url: '/home', viewport: '1920x1080', browser: 'chromium' },
    ];
    const db = mockDb({
      environments: [{ id: 'env-1', name: 'production', isReference: 1 }],
      snapshots: routes,
      environmentDiffs: [{ passed: 'true' }],
      projects: [{ workspaceId: 'ws-1', name: 'My Project' }],
      workspaceSettings: [{ slackWebhookUrl: 'https://hooks.slack.com/test' }],
    });

    mockComputeEnvironmentDiff.mockResolvedValue({
      status: 'computed',
      diff: { passed: false, pixelDiffPercent: 500, ssimScore: 8000 },
    });

    mockIsNotificationEnabled.mockResolvedValue(false);

    await detectEnvironmentDrift(db, mockStorage, bucket, {
      captureRunId: 'run-1',
      environmentName: 'staging',
      projectId: 'proj-1',
    });

    expect(mockIsNotificationEnabled).toHaveBeenCalledWith(
      db, 'ws-1', 'environment_drift', 'slack',
    );
    expect(mockSendEnvironmentDriftNotification).not.toHaveBeenCalled();
  });
});

describe('sendEnvironmentDriftNotification', () => {
  it('formats correct Slack Block Kit payload interface', () => {
    const payload: EnvironmentDriftNotification = {
      projectName: 'Test Project',
      sourceEnv: 'staging',
      targetEnv: 'production',
      failedRouteCount: 3,
      totalRouteCount: 10,
      dashboardUrl: 'https://sentinel.example.com/projects/proj-1/environments',
    };

    expect(payload.projectName).toBe('Test Project');
    expect(payload.sourceEnv).toBe('staging');
    expect(payload.targetEnv).toBe('production');
    expect(payload.failedRouteCount).toBe(3);
    expect(payload.totalRouteCount).toBe(10);
    expect(payload.dashboardUrl).toContain('/environments');
  });
});
