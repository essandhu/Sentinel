import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { S3Client } from '@aws-sdk/client-s3';

// Mock all external dependencies before importing the module under test
vi.mock('../../capture/capture-engine.js', () => ({
  CaptureEngine: vi.fn().mockImplementation(function () {
    // Default: return empty results
  }),
}));
vi.mock('../../diff/diff-engine.js', () => ({
  runDualDiff: vi.fn(),
}));
vi.mock('../../config/config-loader.js', () => ({
  loadConfig: vi.fn(),
  resolveThresholds: vi.fn(),
}));
vi.mock('@sentinel/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sentinel/storage')>();
  return {
    ...actual,
    uploadBuffer: vi.fn(),
    downloadBuffer: vi.fn(),
  };
});
vi.mock('../../adapters/adapter-registry.js', () => ({
  dispatchAdapters: vi.fn(),
  specsToRoutes: vi.fn(),
  compareTokenSpec: vi.fn(),
}));
vi.mock('../../classify/index.js', () => ({
  classifyDiff: vi.fn().mockReturnValue(null),
}));

// Mock playwright
const mockPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  waitForLoadState: vi.fn().mockResolvedValue(undefined),
  locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(0) }),
  close: vi.fn().mockResolvedValue(undefined),
};
const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
};
const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(undefined),
};
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

import { processCaptureJob } from '../capture-worker.js';
import { CaptureEngine } from '../../capture/capture-engine.js';
import { loadConfig, resolveThresholds } from '../../config/config-loader.js';
import { uploadBuffer } from '@sentinel/storage';
import { dispatchAdapters, specsToRoutes } from '../../adapters/adapter-registry.js';

const mockLoadConfig = vi.mocked(loadConfig);
const mockResolveThresholds = vi.mocked(resolveThresholds);
const mockUploadBuffer = vi.mocked(uploadBuffer);
const MockCaptureEngine = vi.mocked(CaptureEngine);
const mockDispatchAdapters = vi.mocked(dispatchAdapters);
const mockSpecsToRoutes = vi.mocked(specsToRoutes);

const mockConfig = {
  baseUrl: 'http://localhost:3000',
  capture: {
    viewports: ['1280x720'],
    routes: [
      { name: 'home', path: '/', viewports: undefined, mask: undefined, thresholds: undefined },
    ],
  },
  thresholds: { pixelDiffPercent: 0.1, ssimMin: 0.95 },
};

function buildMockDb(overrides?: {
  captureRunRows?: object[];
  snapshotRows?: object[];
  componentRows?: object[];
}) {
  const captureRunRows = overrides?.captureRunRows ?? [
    { id: 'run-123', projectId: 'proj-456', status: 'pending' },
  ];
  const snapshotRows = overrides?.snapshotRows ?? [];
  const componentRows = overrides?.componentRows ?? [];

  const makeChainable = (resolveValue: unknown) => {
    const obj: Record<string, unknown> = {};
    obj.then = (onfulfilled: (v: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(onfulfilled);
    obj.where = vi.fn(() => obj);
    obj.set = vi.fn(() => obj);
    obj.values = vi.fn(() => obj);
    obj.from = vi.fn(() => obj);
    obj.innerJoin = vi.fn(() => obj);
    obj.orderBy = vi.fn(() => obj);
    obj.limit = vi.fn(() => obj);
    return obj;
  };

  const updateChainable = makeChainable(undefined);
  const insertChainable = makeChainable([{ id: 'diff-report-id' }]);
  insertChainable.returning = vi.fn(() => insertChainable);

  let selectCallCount = 0;
  const selectFn = vi.fn(() => {
    selectCallCount++;
    // Call 1: get captureRun row
    // Call 2+: baseline lookups (return snapshotRows)
    // Last: component query (return empty by default)
    if (selectCallCount === 1) {
      return makeChainable(captureRunRows);
    }
    return makeChainable(snapshotRows);
  });

  const db = {
    update: vi.fn(() => updateChainable),
    insert: vi.fn(() => insertChainable),
    select: selectFn,
  };

  return { db, updateChainable, insertChainable };
}

const mockStorageClient = {} as S3Client;

describe('scheduled capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockLoadConfig.mockResolvedValue(mockConfig as never);
    mockResolveThresholds.mockReturnValue({ pixelDiffPercent: 0.1, ssimMin: 0.95 });
    mockUploadBuffer.mockResolvedValue(undefined);

    mockDispatchAdapters.mockResolvedValue({
      storybook: [],
      image: [],
      tokens: [],
      figma: [],
    });
    mockSpecsToRoutes.mockReturnValue({ routes: [], baselineSpecs: [] });

    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockResolvedValue([
          {
            routeName: 'home',
            routePath: '/',
            viewport: '1280x720',
            screenshotBuffer: Buffer.from('screenshot-data'),
            domHash: 'abc123',
            skipped: false,
          },
        ]),
      };
    });
  });

  it('creates captureRun with source=scheduled and scheduleId when no captureRunId provided', async () => {
    const { db, insertChainable } = buildMockDb();

    await processCaptureJob(
      {
        configPath: '/path/to/config.yml',
        source: 'scheduled',
        scheduleId: 'sched-001',
        projectId: 'proj-456',
      },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // First insert should be the captureRun creation
    const firstInsertCall = vi.mocked(db.insert).mock.calls[0];
    expect(firstInsertCall).toBeDefined();
    // Verify the chainable values() was called with source and scheduleId
    const valuesCall = vi.mocked(insertChainable.values as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(valuesCall[0]).toMatchObject({
      projectId: 'proj-456',
      source: 'scheduled',
      scheduleId: 'sched-001',
      status: 'pending',
    });
  });

  it('updates captureSchedules.lastRunAt and lastRunStatus on completion', async () => {
    const { db, updateChainable } = buildMockDb();

    await processCaptureJob(
      {
        captureRunId: 'run-123',
        configPath: '/path/to/config.yml',
        source: 'scheduled',
        scheduleId: 'sched-001',
      },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // Collect all set() calls on the update chainable
    const setCalls = vi.mocked(updateChainable.set as ReturnType<typeof vi.fn>).mock.calls;

    // Find the call that sets lastRunStatus to 'completed' (schedule update)
    const scheduleCompletedUpdate = setCalls.find(
      (c) => c[0] && (c[0] as Record<string, unknown>).lastRunStatus === 'completed',
    );
    expect(scheduleCompletedUpdate).toBeDefined();
    expect((scheduleCompletedUpdate![0] as Record<string, unknown>).lastRunAt).toBeInstanceOf(Date);
  });

  it('updates captureSchedules.lastRunStatus to failed on job failure', async () => {
    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockRejectedValue(new Error('Capture failed')),
      };
    });

    const { db, updateChainable } = buildMockDb();

    await expect(
      processCaptureJob(
        {
          captureRunId: 'run-123',
          configPath: '/path/to/config.yml',
          source: 'scheduled',
          scheduleId: 'sched-001',
        },
        { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
      ),
    ).rejects.toThrow('Capture failed');

    const setCalls = vi.mocked(updateChainable.set as ReturnType<typeof vi.fn>).mock.calls;

    // Find the call that sets lastRunStatus to 'failed' (schedule update)
    const scheduleFailedUpdate = setCalls.find(
      (c) => c[0] && (c[0] as Record<string, unknown>).lastRunStatus === 'failed',
    );
    expect(scheduleFailedUpdate).toBeDefined();
    expect((scheduleFailedUpdate![0] as Record<string, unknown>).lastRunAt).toBeInstanceOf(Date);
  });

  it('does not update captureSchedules when no scheduleId is present', async () => {
    const { db, updateChainable } = buildMockDb();

    await processCaptureJob(
      {
        captureRunId: 'run-123',
        configPath: '/path/to/config.yml',
      },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    const setCalls = vi.mocked(updateChainable.set as ReturnType<typeof vi.fn>).mock.calls;

    // Should NOT have any schedule status updates
    const scheduleUpdates = setCalls.filter(
      (c) => c[0] && (c[0] as Record<string, unknown>).lastRunStatus !== undefined,
    );
    expect(scheduleUpdates).toHaveLength(0);
  });
});
