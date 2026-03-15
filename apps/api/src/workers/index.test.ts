import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Hoisted mocks ----------
const mockCreateDb = vi.hoisted(() => vi.fn());
const mockCreateStorageClient = vi.hoisted(() => vi.fn());
const mockDownloadBuffer = vi.hoisted(() => vi.fn());
const mockUploadBuffer = vi.hoisted(() => vi.fn());
const mockProcessCaptureJob = vi.hoisted(() => vi.fn());
const mockProcessCaptureShardJob = vi.hoisted(() => vi.fn());
const mockLoadConfig = vi.hoisted(() => vi.fn());
const mockExpandParameterMatrix = vi.hoisted(() => vi.fn());
const mockExpandBoundaryViewports = vi.hoisted(() => vi.fn());
const mockLoadAllPlugins = vi.hoisted(() => vi.fn());
const mockSetPluginsForRun = vi.hoisted(() => vi.fn());
const mockClearPluginsForRun = vi.hoisted(() => vi.fn());
const mockSendPostJobNotifications = vi.hoisted(() => vi.fn());
const mockProcessFigmaResyncJob = vi.hoisted(() => vi.fn());
const mockComputeShardPlan = vi.hoisted(() => vi.fn());
const mockGetFlowProducer = vi.hoisted(() => vi.fn());
const mockDetectEnvironmentDrift = vi.hoisted(() => vi.fn());
const mockValidateRedis = vi.hoisted(() => vi.fn());
const mockParseRedisUrl = vi.hoisted(() => vi.fn());

// Mock DB chain builder
function buildMockDb(selectResponses: unknown[][] = [], updateResult?: unknown[]) {
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

  const makeUpdateChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
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
    update: vi.fn(() => makeUpdateChain(updateResult ?? [])),
  };
}

const mockDb = buildMockDb();

vi.mock('@sentinel/db', () => ({
  createDb: (...args: any[]) => {
    mockCreateDb(...args);
    return mockDb;
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.projectId',
    environmentName: 'captureRuns.environmentName',
    shardCount: 'captureRuns.shardCount',
    totalRoutes: 'captureRuns.totalRoutes',
    status: 'captureRuns.status',
    completedAt: 'captureRuns.completedAt',
  },
  breakpointPresets: {
    projectId: 'breakpointPresets.projectId',
    sortOrder: 'breakpointPresets.sortOrder',
  },
  projects: {
    id: 'projects.id',
    boundaryTestingEnabled: 'projects.boundaryTestingEnabled',
  },
  environments: {
    projectId: 'environments.projectId',
    name: 'environments.name',
    baseUrl: 'environments.baseUrl',
  },
}));

vi.mock('@sentinel/storage', () => ({
  createStorageClient: mockCreateStorageClient,
  downloadBuffer: mockDownloadBuffer,
  uploadBuffer: mockUploadBuffer,
}));

vi.mock('@sentinel/capture', () => ({
  processCaptureJob: mockProcessCaptureJob,
  processCaptureShardJob: mockProcessCaptureShardJob,
  loadConfig: mockLoadConfig,
  expandParameterMatrix: mockExpandParameterMatrix,
  expandBoundaryViewports: mockExpandBoundaryViewports,
  loadAllPlugins: mockLoadAllPlugins,
  PluginHookRunner: vi.fn().mockImplementation(() => ({
    beforeCapture: vi.fn().mockResolvedValue(undefined),
  })),
  setPluginsForRun: mockSetPluginsForRun,
  clearPluginsForRun: mockClearPluginsForRun,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
}));

vi.mock('../services/post-job-notifications.js', () => ({
  sendPostJobNotifications: mockSendPostJobNotifications,
}));

vi.mock('./figma-resync.js', () => ({
  processFigmaResyncJob: mockProcessFigmaResyncJob,
}));

vi.mock('../shard-plan.js', () => ({
  computeShardPlan: mockComputeShardPlan,
}));

vi.mock('../queue.js', () => ({
  getFlowProducer: mockGetFlowProducer,
  QUEUE_NAME: 'capture',
}));

vi.mock('../services/environment-drift.js', () => ({
  detectEnvironmentDrift: mockDetectEnvironmentDrift,
}));

vi.mock('./validate-redis.js', () => ({
  validateRedis: mockValidateRedis,
}));

vi.mock('./parse-redis-url.js', () => ({
  parseRedisUrl: mockParseRedisUrl,
}));

import { createJobProcessor } from './index.js';

describe('createJobProcessor', () => {
  let processor: (job: any) => Promise<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.S3_ENDPOINT = 'http://minio:9000';
    process.env.S3_REGION = 'us-east-1';
    process.env.S3_ACCESS_KEY = 'testkey';
    process.env.S3_SECRET_KEY = 'testsecret';
    process.env.S3_BUCKET = 'test-bucket';

    processor = createJobProcessor();
  });

  describe('figma-resync jobs', () => {
    it('delegates to processFigmaResyncJob', async () => {
      const jobData = { fileKey: 'fk-1', workspaceId: 'ws-1' };
      const job = { name: 'figma-resync', data: jobData };

      await processor(job);

      expect(mockProcessFigmaResyncJob).toHaveBeenCalledWith(
        jobData,
        expect.objectContaining({ bucket: 'test-bucket' }),
      );
    });
  });

  describe('shard jobs', () => {
    it('delegates to processCaptureShardJob with progress callback', async () => {
      const jobData = {
        type: 'shard',
        shardIndex: 0,
        captureRunId: 'run-1',
        routes: [],
        viewports: ['1280x720'],
        browsers: ['chromium'],
      };
      const mockUpdateProgress = vi.fn().mockResolvedValue(undefined);
      const job = { name: 'capture-shard', data: jobData, updateProgress: mockUpdateProgress };

      mockProcessCaptureShardJob.mockResolvedValue({ completed: true });
      const result = await processor(job);

      expect(mockProcessCaptureShardJob).toHaveBeenCalledWith(
        jobData,
        expect.objectContaining({
          bucket: 'test-bucket',
          onProgress: expect.any(Function),
        }),
      );
      expect(result).toEqual({ completed: true });
    });
  });

  describe('aggregate jobs', () => {
    it('marks run completed when no shard failures', async () => {
      const jobData = {
        type: 'aggregate',
        captureRunId: 'run-1',
      };
      const job = {
        name: 'capture-aggregate',
        data: jobData,
        getChildrenValues: vi.fn().mockResolvedValue({ 'child-1': {} }),
        getFailedChildrenValues: vi.fn().mockResolvedValue({}),
      };

      const result = await processor(job);

      expect(result.status).toBe('completed');
      expect(result.captureRunId).toBe('run-1');
      expect(mockClearPluginsForRun).toHaveBeenCalledWith('run-1');
      expect(mockSendPostJobNotifications).toHaveBeenCalled();
    });

    it('marks run partial when some shards failed', async () => {
      const jobData = {
        type: 'aggregate',
        captureRunId: 'run-2',
      };
      const job = {
        name: 'capture-aggregate',
        data: jobData,
        getChildrenValues: vi.fn().mockResolvedValue({ 'child-1': {} }),
        getFailedChildrenValues: vi.fn().mockResolvedValue({ 'child-2': 'error' }),
      };

      const result = await processor(job);

      expect(result.status).toBe('partial');
    });

    it('runs environment drift detection when environmentName is set', async () => {
      const jobData = {
        type: 'aggregate',
        captureRunId: 'run-3',
        environmentName: 'staging',
        projectId: 'proj-1',
      };
      const job = {
        name: 'capture-aggregate',
        data: jobData,
        getChildrenValues: vi.fn().mockResolvedValue({}),
        getFailedChildrenValues: vi.fn().mockResolvedValue({}),
      };

      await processor(job);

      expect(mockDetectEnvironmentDrift).toHaveBeenCalledWith(
        mockDb,
        expect.any(Object),
        'test-bucket',
        expect.objectContaining({
          captureRunId: 'run-3',
          environmentName: 'staging',
          projectId: 'proj-1',
        }),
      );
    });

    it('catches and logs notification errors without throwing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSendPostJobNotifications.mockRejectedValue(new Error('Slack down'));

      const jobData = {
        type: 'aggregate',
        captureRunId: 'run-4',
      };
      const job = {
        name: 'capture-aggregate',
        data: jobData,
        getChildrenValues: vi.fn().mockResolvedValue({}),
        getFailedChildrenValues: vi.fn().mockResolvedValue({}),
      };

      // Should not throw
      const result = await processor(job);
      expect(result.status).toBe('completed');

      consoleSpy.mockRestore();
    });

    it('catches and logs drift detection errors without throwing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDetectEnvironmentDrift.mockRejectedValue(new Error('drift error'));

      const jobData = {
        type: 'aggregate',
        captureRunId: 'run-5',
        environmentName: 'prod',
        projectId: 'proj-1',
      };
      const job = {
        name: 'capture-aggregate',
        data: jobData,
        getChildrenValues: vi.fn().mockResolvedValue({}),
        getFailedChildrenValues: vi.fn().mockResolvedValue({}),
      };

      const result = await processor(job);
      expect(result.status).toBe('completed');

      consoleSpy.mockRestore();
    });
  });

  describe('legacy capture jobs', () => {
    it('delegates to processCaptureJob for non-typed jobs', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const jobData = {
        captureRunId: 'run-legacy',
        configPath: '/path/to/config.yml',
        projectId: 'proj-1',
      };
      const mockUpdateProgress = vi.fn().mockResolvedValue(undefined);
      const job = { name: 'capture', data: jobData, updateProgress: mockUpdateProgress };

      await processor(job);

      expect(mockProcessCaptureJob).toHaveBeenCalledWith(
        jobData,
        expect.objectContaining({
          bucket: 'test-bucket',
          onProgress: expect.any(Function),
        }),
      );
      consoleSpy.mockRestore();
    });

    it('calls sendPostJobNotifications after legacy capture job', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const jobData = {
        captureRunId: 'run-legacy-2',
        configPath: '/path/to/config.yml',
      };
      const job = { name: 'capture', data: jobData, updateProgress: vi.fn().mockResolvedValue(undefined) };

      await processor(job);

      expect(mockSendPostJobNotifications).toHaveBeenCalledWith(mockDb, 'run-legacy-2');
      consoleSpy.mockRestore();
    });

    it('catches notification errors in legacy jobs without throwing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSendPostJobNotifications.mockRejectedValue(new Error('fail'));

      const jobData = {
        captureRunId: 'run-legacy-3',
        configPath: '/path/to/config.yml',
      };
      const job = { name: 'capture', data: jobData, updateProgress: vi.fn().mockResolvedValue(undefined) };

      // Should not throw
      await processor(job);

      consoleSpy.mockRestore();
    });
  });
});
