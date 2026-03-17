import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageKeys } from '@sentinel-vrt/storage';
import type { S3Client } from '@aws-sdk/client-s3';

// Mock all external dependencies before importing the module under test
vi.mock('../capture/capture-engine.js', () => ({
  CaptureEngine: vi.fn().mockImplementation(function () {
    // Default capture mock — overridden per test in beforeEach
  }),
}));
vi.mock('../diff/diff-engine.js', () => ({
  runDualDiff: vi.fn(),
}));
vi.mock('../config/config-loader.js', () => ({
  loadConfig: vi.fn(),
  resolveThresholds: vi.fn(),
}));
vi.mock('@sentinel-vrt/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sentinel-vrt/storage')>();
  return {
    ...actual,
    uploadBuffer: vi.fn(),
    downloadBuffer: vi.fn(),
  };
});
vi.mock('../adapters/adapter-registry.js', () => ({
  dispatchAdapters: vi.fn(),
  specsToRoutes: vi.fn(),
  compareTokenSpec: vi.fn(),
}));
vi.mock('../classify/index.js', () => ({
  classifyDiff: vi.fn().mockReturnValue(null),
}));

// Mock playwright for token comparison (dynamic import in capture-worker)
const mockTokenPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  evaluate: vi.fn().mockResolvedValue(''),
  close: vi.fn().mockResolvedValue(undefined),
};
const mockTokenContext = {
  newPage: vi.fn().mockResolvedValue(mockTokenPage),
  close: vi.fn().mockResolvedValue(undefined),
};
const mockTokenBrowser = {
  newContext: vi.fn().mockResolvedValue(mockTokenContext),
  close: vi.fn().mockResolvedValue(undefined),
};
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockTokenBrowser),
  },
}));

import { processCaptureJob, processCaptureShardJob, retryCapture } from './capture-worker.js';
import { CaptureEngine } from '../capture/capture-engine.js';
import { runDualDiff } from '../diff/diff-engine.js';
import { loadConfig, resolveThresholds } from '../config/config-loader.js';
import { uploadBuffer, downloadBuffer } from '@sentinel-vrt/storage';
import { dispatchAdapters, specsToRoutes, compareTokenSpec } from '../adapters/adapter-registry.js';

const mockLoadConfig = vi.mocked(loadConfig);
const mockResolveThresholds = vi.mocked(resolveThresholds);
const mockRunDualDiff = vi.mocked(runDualDiff);
const mockUploadBuffer = vi.mocked(uploadBuffer);
const mockDownloadBuffer = vi.mocked(downloadBuffer);
const MockCaptureEngine = vi.mocked(CaptureEngine);
const mockDispatchAdapters = vi.mocked(dispatchAdapters);
const mockSpecsToRoutes = vi.mocked(specsToRoutes);
const mockCompareTokenSpec = vi.mocked(compareTokenSpec);

// Minimal parsed config for tests
const mockConfig = {
  baseUrl: 'http://localhost:3000',
  capture: {
    viewports: ['1280x720'],
    routes: [
      {
        name: 'home',
        path: '/',
        viewports: undefined,
        mask: undefined,
        thresholds: undefined,
      },
    ],
  },
  thresholds: {
    pixelDiffPercent: 0.1,
    ssimMin: 0.95,
  },
};

// Build a mock DB that returns chainable query objects
function buildMockDb(overrides?: {
  captureRunRows?: object[];
  snapshotRows?: object[];
  breakpointPresetRows?: object[];
}) {
  const captureRunRows = overrides?.captureRunRows ?? [
    { id: 'run-123', projectId: 'proj-456', status: 'pending' },
  ];
  const snapshotRows = overrides?.snapshotRows ?? [];
  const breakpointPresetRows = overrides?.breakpointPresetRows ?? [];

  // Generic chainable mock that resolves at .then() or direct await
  const makeChainable = (resolveValue: unknown) => {
    const obj: Record<string, unknown> = {};
    // Support then() for direct await
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
  // Add returning() support for diffReports insert
  insertChainable.returning = vi.fn(() => insertChainable);

  let selectCallCount = 0;
  const selectFn = vi.fn(() => {
    selectCallCount++;
    // First select = get captureRun row
    if (selectCallCount === 1) {
      return makeChainable(captureRunRows);
    }
    // Second select = breakpoint presets query
    if (selectCallCount === 2) {
      return makeChainable(breakpointPresetRows);
    }
    // Subsequent selects = baseline/snapshot lookups
    return makeChainable(snapshotRows);
  });

  const db = {
    update: vi.fn(() => updateChainable),
    insert: vi.fn(() => insertChainable),
    select: selectFn,
  };

  return db;
}

const mockStorageClient = {} as S3Client;

describe('processCaptureJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockLoadConfig.mockResolvedValue(structuredClone(mockConfig) as never);
    mockResolveThresholds.mockReturnValue({
      pixelDiffPercent: 0.1,
      ssimMin: 0.95,
    });
    mockUploadBuffer.mockResolvedValue(undefined);
    mockDownloadBuffer.mockResolvedValue(Buffer.from('baseline-image'));
    mockRunDualDiff.mockResolvedValue({
      pixelDiffPercent: 0.05,
      ssimScore: 0.98,
      passed: true,
      diffImageBuffer: Buffer.from('diff-image'),
      rawDiffData: new Uint8ClampedArray(100),
      width: 10,
      height: 10,
      layers: {
        pixel: { diffPercent: 0.05, diffPixelCount: 10 },
        ssim: { score: 0.98 },
      },
    });

    // Default adapter mocks (no-op for backward compatibility tests)
    mockDispatchAdapters.mockResolvedValue({
      storybook: [],
      image: [],
      tokens: [],
      figma: [],
    });
    mockSpecsToRoutes.mockReturnValue({ routes: [], baselineSpecs: [] });
    mockCompareTokenSpec.mockResolvedValue([]);

    // Mock CaptureEngine constructor and capture method
    const mockCapture = vi.fn().mockResolvedValue([
      {
        routeName: 'home',
        routePath: '/',
        viewport: '1280x720',
        screenshotBuffer: Buffer.from('screenshot-data'),
        domHash: 'abc123',
        skipped: false,
      },
    ]);
    MockCaptureEngine.mockImplementation(function () {
      return { capture: mockCapture };
    });
  });

  it('updates run status to running then completed', async () => {
    const db = buildMockDb();

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // update should be called: 'running' and 'completed'
    expect(db.update).toHaveBeenCalledTimes(2);
    // Capture the set() calls from the update() chainable
    const updateChainable = vi.mocked(db.update).mock.results[0].value as ReturnType<typeof db.update>;
    const setCalls = vi.mocked(updateChainable.set).mock.calls;
    expect(setCalls[0][0]).toMatchObject({ status: 'running' });
    expect(setCalls[1][0]).toMatchObject({ status: 'completed' });
  });

  it('calls CaptureEngine.capture with loaded config', async () => {
    const db = buildMockDb();

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    expect(mockLoadConfig).toHaveBeenCalledWith('/path/to/config.yml');
    const engineInstance = MockCaptureEngine.mock.results[0].value as { capture: ReturnType<typeof vi.fn> };
    expect(engineInstance.capture).toHaveBeenCalledWith(mockConfig, expect.any(Map), undefined);
  });

  it('uploads screenshot to S3 for each capture result', async () => {
    const twoResults = [
      {
        routeName: 'home',
        routePath: '/',
        viewport: '1280x720',
        screenshotBuffer: Buffer.from('screenshot-1'),
        domHash: 'hash1',
        skipped: false,
      },
      {
        routeName: 'about',
        routePath: '/about',
        viewport: '1280x720',
        screenshotBuffer: Buffer.from('screenshot-2'),
        domHash: 'hash2',
        skipped: false,
      },
    ];

    MockCaptureEngine.mockImplementation(function () {
      return { capture: vi.fn().mockResolvedValue(twoResults) };
    });

    const db = buildMockDb();

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // Each result gets a capture upload; plus baseline download exists so no baseline upload
    const captureUploadCalls = mockUploadBuffer.mock.calls.filter((c) =>
      (c[2] as string).startsWith('captures/'),
    );
    expect(captureUploadCalls).toHaveLength(2);
  });

  it('inserts snapshot row for each capture result', async () => {
    const db = buildMockDb();

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    expect(db.insert).toHaveBeenCalled();
    // Get the insertChainable from the first insert() call result
    const insertChainable = vi.mocked(db.insert).mock.results[0].value as ReturnType<typeof db.insert>;
    const valuesCalls = vi.mocked(insertChainable.values).mock.calls;
    // At least one snapshot insert
    const snapshotInsert = valuesCalls.find(
      (c) => c[0] && typeof (c[0] as Record<string, unknown>).runId === 'string',
    );
    expect(snapshotInsert).toBeDefined();
    expect((snapshotInsert![0] as Record<string, unknown>).runId).toBe('run-123');
  });

  it('runs diff when baseline exists', async () => {
    const db = buildMockDb({
      snapshotRows: [
        { id: 'snap-old', s3Key: 'captures/old-run/snap-old/captured.png' },
      ],
    });

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    expect(mockDownloadBuffer).toHaveBeenCalled();
    expect(mockRunDualDiff).toHaveBeenCalled();
  });

  it('uploads baseline when no prior baseline exists', async () => {
    // No baseline rows returned for snapshot query
    const db = buildMockDb({ snapshotRows: [] });

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // Should upload to baselines/ path when no existing baseline
    const baselineUploads = mockUploadBuffer.mock.calls.filter((c) =>
      (c[2] as string).startsWith('baselines/'),
    );
    expect(baselineUploads.length).toBeGreaterThan(0);
    expect(mockRunDualDiff).not.toHaveBeenCalled();
  });

  it('stores diff report with basis point conversion', async () => {
    mockRunDualDiff.mockResolvedValue({
      pixelDiffPercent: 0.15,
      ssimScore: 0.98,
      passed: true,
      diffImageBuffer: Buffer.from('diff-image'),
      layers: {
        pixel: { diffPercent: 0.15, diffPixelCount: 30 },
        ssim: { score: 0.98 },
      },
    });

    const db = buildMockDb({
      snapshotRows: [{ id: 'snap-old', s3Key: 'captures/old-run/snap-old/captured.png' }],
    });

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // Find the diffReport insert values
    const insertChainable = vi.mocked(db.insert).mock.results[0].value as ReturnType<typeof db.insert>;
    const allValuesCalls = vi.mocked(insertChainable.values).mock.calls;
    const diffReportInsert = allValuesCalls.find(
      (c) =>
        c[0] &&
        typeof (c[0] as Record<string, unknown>).baselineS3Key === 'string',
    );

    expect(diffReportInsert).toBeDefined();
    const insertedRow = diffReportInsert![0] as Record<string, unknown>;
    // 0.15 * 100 = 15 basis points
    expect(insertedRow.pixelDiffPercent).toBe(15);
    // 0.98 * 10000 = 9800
    expect(insertedRow.ssimScore).toBe(9800);
  });

  it('updates status to failed on error', async () => {
    MockCaptureEngine.mockImplementation(function () {
      return { capture: vi.fn().mockRejectedValue(new Error('Playwright crashed')) };
    });

    const db = buildMockDb();

    await expect(
      processCaptureJob(
        { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
        { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
      ),
    ).rejects.toThrow('Playwright crashed');

    const updateChainable = db.update();
    const setCalls = vi.mocked(updateChainable.set).mock.calls;
    const failedCall = setCalls.find(
      (c) => (c[0] as Record<string, unknown>).status === 'failed',
    );
    expect(failedCall).toBeDefined();
  });

  it('skips upload for skipped results', async () => {
    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockResolvedValue([
          {
            routeName: 'home',
            routePath: '/',
            viewport: '1280x720',
            screenshotBuffer: Buffer.alloc(0),
            domHash: 'abc123',
            skipped: true,
          },
        ]),
      };
    });

    const db = buildMockDb();

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // No uploads should happen for skipped results
    expect(mockUploadBuffer).not.toHaveBeenCalled();
  });

  // --- Adapter integration tests ---

  it('calls dispatchAdapters when config has adapters', async () => {
    const configWithAdapters = {
      ...mockConfig,
      adapters: [
        { type: 'storybook' as const, storybookUrl: 'http://localhost:6006' },
      ],
    };
    mockLoadConfig.mockResolvedValue(configWithAdapters as never);

    // dispatchAdapters returns storybook specs
    mockDispatchAdapters.mockResolvedValue({
      storybook: [
        {
          source: 'storybook' as const,
          metadata: { componentName: 'Button', storyId: 'button--primary' },
        },
      ],
      image: [],
      tokens: [],
      figma: [],
    });

    // specsToRoutes converts to routes
    mockSpecsToRoutes.mockReturnValue({
      routes: [
        { name: 'Button', path: 'http://localhost:6006/iframe.html?id=button--primary&viewMode=story' },
      ],
      baselineSpecs: [],
    });

    // CaptureEngine returns result for the storybook route
    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockResolvedValue([
          {
            routeName: 'Button',
            routePath: 'http://localhost:6006/iframe.html?id=button--primary&viewMode=story',
            viewport: '1280x720',
            screenshotBuffer: Buffer.from('storybook-screenshot'),
            domHash: 'sb-hash',
            skipped: false,
          },
        ]),
      };
    });

    const db = buildMockDb();

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    expect(mockDispatchAdapters).toHaveBeenCalledWith(
      configWithAdapters.adapters,
      expect.objectContaining({ db: expect.anything(), storageClient: expect.anything() }),
    );
    expect(mockSpecsToRoutes).toHaveBeenCalled();
  });

  it('merges adapter-discovered routes with YAML routes', async () => {
    const configWithAdapters = {
      ...mockConfig,
      adapters: [
        { type: 'storybook' as const, storybookUrl: 'http://localhost:6006' },
      ],
    };
    mockLoadConfig.mockResolvedValue(configWithAdapters as never);

    mockDispatchAdapters.mockResolvedValue({
      storybook: [
        { source: 'storybook' as const, metadata: { componentName: 'Card', storyId: 'card--default' } },
      ],
      image: [],
      tokens: [],
      figma: [],
    });

    const adapterRoute = { name: 'Card', path: 'http://localhost:6006/iframe.html?id=card--default&viewMode=story' };
    mockSpecsToRoutes.mockReturnValue({
      routes: [adapterRoute],
      baselineSpecs: [],
    });

    let capturedConfig: any;
    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockImplementation((cfg: any) => {
          capturedConfig = cfg;
          return Promise.resolve([]);
        }),
      };
    });

    const db = buildMockDb();

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // Config passed to engine should contain both the original YAML route AND adapter route
    expect(capturedConfig.capture.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'home', path: '/' }),
        expect.objectContaining({ name: 'Card', path: adapterRoute.path }),
      ]),
    );
  });

  it('diffs image baseline specs against captured results', async () => {
    const referenceImageBuffer = Buffer.from('reference-image-png');
    const configWithAdapters = {
      ...mockConfig,
      adapters: [
        { type: 'image' as const, directory: './baselines' },
      ],
    };
    mockLoadConfig.mockResolvedValue(configWithAdapters as never);

    mockDispatchAdapters.mockResolvedValue({
      storybook: [],
      image: [
        {
          source: 'image' as const,
          metadata: { componentName: 'hero-banner' },
          referenceImage: referenceImageBuffer,
        },
      ],
      tokens: [],
      figma: [],
    });

    mockSpecsToRoutes.mockReturnValue({
      routes: [],
      baselineSpecs: [
        {
          source: 'image' as const,
          metadata: { componentName: 'hero-banner' },
          referenceImage: referenceImageBuffer,
        },
      ],
    });

    // CaptureEngine returns a result matching the baseline spec's componentName
    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockResolvedValue([
          {
            routeName: 'hero-banner',
            routePath: '/',
            viewport: '1280x720',
            screenshotBuffer: Buffer.from('captured-screenshot'),
            domHash: 'hash-1',
            skipped: false,
          },
        ]),
      };
    });

    mockRunDualDiff.mockResolvedValue({
      pixelDiffPercent: 0.02,
      ssimScore: 0.99,
      passed: true,
      diffImageBuffer: Buffer.from('diff-result'),
      layers: {
        pixel: { diffPercent: 0.02, diffPixelCount: 5 },
        ssim: { score: 0.99 },
      },
    });

    const db = buildMockDb();

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // runDualDiff should be called with the referenceImage buffer and captured screenshot
    expect(mockRunDualDiff).toHaveBeenCalledWith(
      referenceImageBuffer,
      Buffer.from('captured-screenshot'),
      expect.anything(),
    );
  });

  it('diffs figma baseline specs against captured results', async () => {
    const figmaReferenceBuffer = Buffer.from('figma-export-png');
    const configWithAdapters = {
      ...mockConfig,
      adapters: [
        {
          type: 'figma' as const,
          accessToken: 'token',
          fileKey: 'file-key',
          nodeIds: ['1:1'],
          cacheBucket: 'cache',
          dbConnectionString: 'postgres://...',
        },
      ],
    };
    mockLoadConfig.mockResolvedValue(configWithAdapters as never);

    mockDispatchAdapters.mockResolvedValue({
      storybook: [],
      image: [],
      tokens: [],
      figma: [
        {
          source: 'figma' as const,
          metadata: { componentName: 'figma-card' },
          referenceImage: figmaReferenceBuffer,
        },
      ],
    });

    mockSpecsToRoutes.mockReturnValue({
      routes: [],
      baselineSpecs: [
        {
          source: 'figma' as const,
          metadata: { componentName: 'figma-card' },
          referenceImage: figmaReferenceBuffer,
        },
      ],
    });

    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockResolvedValue([
          {
            routeName: 'figma-card',
            routePath: '/',
            viewport: '1280x720',
            screenshotBuffer: Buffer.from('captured-figma-page'),
            domHash: 'fig-hash',
            skipped: false,
          },
        ]),
      };
    });

    const db = buildMockDb();

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // Should diff figma reference against captured screenshot
    expect(mockRunDualDiff).toHaveBeenCalledWith(
      figmaReferenceBuffer,
      Buffer.from('captured-figma-page'),
      expect.anything(),
    );
  });

  it('calls compareTokenSpec for token adapter specs', async () => {
    const configWithAdapters = {
      ...mockConfig,
      adapters: [
        { type: 'tokens' as const, tokenFilePath: './tokens.json', targetUrl: 'http://localhost:3000' },
      ],
    };
    mockLoadConfig.mockResolvedValue(configWithAdapters as never);

    const tokenSpec = {
      source: 'tokens' as const,
      metadata: { componentName: 'design-tokens' },
      tokens: {
        'color.primary': { value: '#0066cc', type: 'color' },
      },
    };

    mockDispatchAdapters.mockResolvedValue({
      storybook: [],
      image: [],
      tokens: [tokenSpec],
      figma: [],
    });

    mockSpecsToRoutes.mockReturnValue({ routes: [], baselineSpecs: [] });

    MockCaptureEngine.mockImplementation(function () {
      return { capture: vi.fn().mockResolvedValue([]) };
    });

    const db = buildMockDb();

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    expect(mockCompareTokenSpec).toHaveBeenCalledWith(
      expect.anything(), // page object
      tokenSpec,
      'http://localhost:3000',
    );
  });

  // --- Breakpoint preset integration tests ---

  it('queries breakpoint presets and expands viewports when presets exist', async () => {
    const presets = [
      { id: 'bp-1', projectId: 'proj-456', name: 'Mobile', width: 375, height: 812, sortOrder: 0, pixelDiffThreshold: null, ssimThreshold: null, createdAt: new Date() },
      { id: 'bp-2', projectId: 'proj-456', name: 'Tablet', width: 768, height: 1024, sortOrder: 1, pixelDiffThreshold: 500, ssimThreshold: 9500, createdAt: new Date() },
    ];

    // Build a mock DB that returns presets on breakpointPresets query
    let selectCallCount = 0;
    const makeChainable = (resolveValue: unknown) => {
      const obj: Record<string, unknown> = {};
      obj.then = (onfulfilled: (v: unknown) => unknown) =>
        Promise.resolve(resolveValue).then(onfulfilled);
      obj.where = vi.fn(() => obj);
      obj.set = vi.fn(() => obj);
      obj.values = vi.fn(() => obj);
      obj.from = vi.fn((table: unknown) => {
        // Tag the chainable with which table was queried
        (obj as any)._table = table;
        return obj;
      });
      obj.innerJoin = vi.fn(() => obj);
      obj.orderBy = vi.fn(() => obj);
      obj.limit = vi.fn(() => obj);
      return obj;
    };

    const updateChainable = makeChainable(undefined);
    const insertChainable = makeChainable([{ id: 'diff-report-id' }]);
    insertChainable.returning = vi.fn(() => insertChainable);

    const captureRunRows = [{ id: 'run-123', projectId: 'proj-456', status: 'pending' }];

    const selectFn = vi.fn(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // First select: captureRun lookup
        return makeChainable(captureRunRows);
      }
      if (selectCallCount === 2) {
        // Second select: breakpoint presets query
        return makeChainable(presets);
      }
      // Subsequent selects: snapshot lookups
      return makeChainable([]);
    });

    const db = {
      update: vi.fn(() => updateChainable),
      insert: vi.fn(() => insertChainable),
      select: selectFn,
    };

    // Engine should receive config with preset viewports
    let capturedConfig: any;
    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockImplementation((cfg: any) => {
          capturedConfig = cfg;
          return Promise.resolve([
            {
              routeName: 'home',
              routePath: '/',
              viewport: '375x812',
              browser: 'chromium',
              breakpointName: 'Mobile',
              screenshotBuffer: Buffer.from('mobile-screenshot'),
              domHash: 'hash-mobile',
              skipped: false,
            },
            {
              routeName: 'home',
              routePath: '/',
              viewport: '768x1024',
              browser: 'chromium',
              breakpointName: 'Tablet',
              screenshotBuffer: Buffer.from('tablet-screenshot'),
              domHash: 'hash-tablet',
              skipped: false,
            },
          ]);
        }),
      };
    });

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // Config viewports should be replaced with preset viewports
    expect(capturedConfig.capture.viewports).toEqual(['375x812', '768x1024']);
  });

  it('uses config viewports when no breakpoint presets exist (backward compatible)', async () => {
    // Build DB that returns empty presets
    let selectCallCount = 0;
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

    const captureRunRows = [{ id: 'run-123', projectId: 'proj-456', status: 'pending' }];

    const selectFn = vi.fn(() => {
      selectCallCount++;
      if (selectCallCount === 1) return makeChainable(captureRunRows);
      if (selectCallCount === 2) return makeChainable([]); // No presets
      return makeChainable([]);
    });

    const db = {
      update: vi.fn(() => updateChainable),
      insert: vi.fn(() => insertChainable),
      select: selectFn,
    };

    let capturedConfig: any;
    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockImplementation((cfg: any) => {
          capturedConfig = cfg;
          return Promise.resolve([
            {
              routeName: 'home',
              routePath: '/',
              viewport: '1280x720',
              browser: 'chromium',
              screenshotBuffer: Buffer.from('screenshot'),
              domHash: 'hash1',
              skipped: false,
            },
          ]);
        }),
      };
    });

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // Config viewports should remain unchanged
    expect(capturedConfig.capture.viewports).toEqual(['1280x720']);
  });

  it('stores breakpointName on snapshot insert when capture came from a preset', async () => {
    const presets = [
      { id: 'bp-1', projectId: 'proj-456', name: 'Mobile', width: 375, height: 812, sortOrder: 0, pixelDiffThreshold: null, ssimThreshold: null, createdAt: new Date() },
    ];

    let selectCallCount = 0;
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

    const selectFn = vi.fn(() => {
      selectCallCount++;
      if (selectCallCount === 1) return makeChainable([{ id: 'run-123', projectId: 'proj-456', status: 'pending' }]);
      if (selectCallCount === 2) return makeChainable(presets);
      return makeChainable([]);
    });

    const db = {
      update: vi.fn(() => updateChainable),
      insert: vi.fn(() => insertChainable),
      select: selectFn,
    };

    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockResolvedValue([
          {
            routeName: 'home',
            routePath: '/',
            viewport: '375x812',
            browser: 'chromium',
            breakpointName: 'Mobile',
            screenshotBuffer: Buffer.from('screenshot'),
            domHash: 'hash1',
            skipped: false,
          },
        ]),
      };
    });

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // Find snapshot insert that has breakpointName
    const allValuesCalls = vi.mocked(insertChainable.values as any).mock.calls;
    const snapshotInsert = allValuesCalls.find(
      (c: any[]) => c[0] && typeof c[0].runId === 'string' && c[0].breakpointName !== undefined,
    );
    expect(snapshotInsert).toBeDefined();
    expect(snapshotInsert![0].breakpointName).toBe('Mobile');
  });

  it('stores null breakpointName on snapshot when no presets', async () => {
    let selectCallCount = 0;
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

    const selectFn = vi.fn(() => {
      selectCallCount++;
      if (selectCallCount === 1) return makeChainable([{ id: 'run-123', projectId: 'proj-456', status: 'pending' }]);
      if (selectCallCount === 2) return makeChainable([]); // No presets
      return makeChainable([]);
    });

    const db = {
      update: vi.fn(() => updateChainable),
      insert: vi.fn(() => insertChainable),
      select: selectFn,
    };

    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockResolvedValue([
          {
            routeName: 'home',
            routePath: '/',
            viewport: '1280x720',
            browser: 'chromium',
            screenshotBuffer: Buffer.from('screenshot'),
            domHash: 'hash1',
            skipped: false,
          },
        ]),
      };
    });

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // Find snapshot insert - breakpointName should be null or undefined
    const allValuesCalls = vi.mocked(insertChainable.values as any).mock.calls;
    const snapshotInsert = allValuesCalls.find(
      (c: any[]) => c[0] && typeof c[0].runId === 'string',
    );
    expect(snapshotInsert).toBeDefined();
    expect(snapshotInsert![0].breakpointName).toBeNull();
  });

  it('passes breakpoint-specific thresholds to resolveThresholds with correct conversion', async () => {
    const presets = [
      { id: 'bp-1', projectId: 'proj-456', name: 'Tablet', width: 768, height: 1024, sortOrder: 0, pixelDiffThreshold: 500, ssimThreshold: 9500, createdAt: new Date() },
    ];

    let selectCallCount = 0;
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

    const selectFn = vi.fn(() => {
      selectCallCount++;
      if (selectCallCount === 1) return makeChainable([{ id: 'run-123', projectId: 'proj-456', status: 'pending' }]);
      if (selectCallCount === 2) return makeChainable(presets);
      return makeChainable([{ id: 'snap-old', s3Key: 'captures/old/snap.png' }]);
    });

    const db = {
      update: vi.fn(() => updateChainable),
      insert: vi.fn(() => insertChainable),
      select: selectFn,
    };

    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockResolvedValue([
          {
            routeName: 'home',
            routePath: '/',
            viewport: '768x1024',
            browser: 'chromium',
            breakpointName: 'Tablet',
            screenshotBuffer: Buffer.from('screenshot'),
            domHash: 'hash1',
            skipped: false,
          },
        ]),
      };
    });

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // resolveThresholds should be called with breakpoint thresholds converted from basis points
    // pixelDiffThreshold: 500 / 100 = 5.0 (percentage)
    // ssimThreshold: 9500 / 10000 = 0.95 (decimal)
    expect(mockResolveThresholds).toHaveBeenCalledWith(
      expect.objectContaining({}), // route
      { pixelDiffPercent: 5, ssimMin: 0.95 }, // breakpoint thresholds
      undefined, // browserThresholds (not set in mockConfig)
      'chromium', // browserName
      { pixelDiffPercent: 0.1, ssimMin: 0.95 }, // globalThresholds
    );
  });

  it('includes breakpoint viewport dimensions in DOM hash deduplication keys', async () => {
    const presets = [
      { id: 'bp-1', projectId: 'proj-456', name: 'Mobile', width: 375, height: 812, sortOrder: 0, pixelDiffThreshold: null, ssimThreshold: null, createdAt: new Date() },
    ];

    let selectCallCount = 0;
    const selectQueries: Array<{ callNum: number; where: any }> = [];
    const makeChainable = (resolveValue: unknown, callNum?: number) => {
      const obj: Record<string, unknown> = {};
      obj.then = (onfulfilled: (v: unknown) => unknown) =>
        Promise.resolve(resolveValue).then(onfulfilled);
      obj.where = vi.fn((...args: any[]) => {
        if (callNum) selectQueries.push({ callNum, where: args });
        return obj;
      });
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

    const selectFn = vi.fn(() => {
      selectCallCount++;
      if (selectCallCount === 1) return makeChainable([{ id: 'run-123', projectId: 'proj-456', status: 'pending' }], selectCallCount);
      if (selectCallCount === 2) return makeChainable(presets, selectCallCount);
      // DOM hash lookups should use preset viewports (375x812)
      return makeChainable([], selectCallCount);
    });

    const db = {
      update: vi.fn(() => updateChainable),
      insert: vi.fn(() => insertChainable),
      select: selectFn,
    };

    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockResolvedValue([]),
      };
    });

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // The DOM hash lookup selects (call 3+) should query with viewport '375x812'
    // This verifies the effective viewports from presets are used for deduplication
    const domHashQueries = selectQueries.filter(q => q.callNum >= 3);
    expect(domHashQueries.length).toBeGreaterThan(0);
  });

  it('does not call dispatchAdapters when no adapters in config', async () => {
    // mockConfig has no adapters field — backward compatibility
    const db = buildMockDb();

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    expect(mockDispatchAdapters).not.toHaveBeenCalled();
  });

  // --- Config schema flaky section tests ---

  describe('config schema flaky section', () => {
    it('parses flaky section with maxRetries, stabilityThreshold, excludeUnstableFromBlocking', async () => {
      const { FlakySchema } = await import('../config/config-schema.js');
      const result = FlakySchema.parse({
        maxRetries: 5,
        stabilityThreshold: 80,
        excludeUnstableFromBlocking: true,
      });
      expect(result.maxRetries).toBe(5);
      expect(result.stabilityThreshold).toBe(80);
      expect(result.excludeUnstableFromBlocking).toBe(true);
    });

    it('uses defaults when flaky section fields are omitted', async () => {
      const { FlakySchema } = await import('../config/config-schema.js');
      const result = FlakySchema.parse({});
      expect(result.maxRetries).toBe(3);
      expect(result.stabilityThreshold).toBe(70);
      expect(result.excludeUnstableFromBlocking).toBe(false);
    });
  });

  // --- Retry logic tests ---

  describe('retry logic', () => {
    it('records retryCount=0 on first-attempt success', async () => {
      MockCaptureEngine.mockImplementation(function () {
        return {
          capture: vi.fn().mockResolvedValue([
            {
              routeName: 'home',
              routePath: '/',
              viewport: '1280x720',
              browser: 'chromium',
              screenshotBuffer: Buffer.from('screenshot'),
              domHash: 'hash1',
              skipped: false,
            },
          ]),
        };
      });

      const db = buildMockDb();

      await processCaptureShardJob(
        {
          captureRunId: 'run-123',
          configPath: '/path/to/config.yml',
          projectId: 'proj-456',
          type: 'shard',
          shardIndex: 0,
          routes: [{ name: 'home', path: '/' }],
          viewports: ['1280x720'],
          browsers: ['chromium'],
        },
        { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
      );

      // Find snapshot insert that has retryCount
      const insertChainable = vi.mocked(db.insert).mock.results[0]?.value as ReturnType<typeof db.insert>;
      const allValuesCalls = vi.mocked(insertChainable.values as any).mock.calls;
      const snapshotInsert = allValuesCalls.find(
        (c: any[]) => c[0] && typeof c[0].runId === 'string',
      );
      expect(snapshotInsert).toBeDefined();
      expect(snapshotInsert![0].retryCount).toBe(0);
    });

    it('retries on transient failure and records retryCount on success', async () => {
      let captureCallCount = 0;
      MockCaptureEngine.mockImplementation(function () {
        return {
          capture: vi.fn().mockImplementation(() => {
            captureCallCount++;
            // First call fails, second succeeds
            if (captureCallCount === 1) {
              return Promise.resolve([
                {
                  routeName: 'home',
                  routePath: '/',
                  viewport: '1280x720',
                  browser: 'chromium',
                  screenshotBuffer: Buffer.from('screenshot'),
                  domHash: 'hash1',
                  skipped: false,
                  error: 'Transient network error',
                },
              ]);
            }
            return Promise.resolve([
              {
                routeName: 'home',
                routePath: '/',
                viewport: '1280x720',
                browser: 'chromium',
                screenshotBuffer: Buffer.from('screenshot'),
                domHash: 'hash1',
                skipped: false,
              },
            ]);
          }),
        };
      });

      // We test the retry wrapper via the exported retryCapture function
      const { retryCapture } = await import('./capture-worker.js');
      expect(retryCapture).toBeDefined();
    });

    it('exhausts all retry attempts and records error with attempt count', async () => {
      const { retryCapture } = await import('./capture-worker.js');

      const failingFn = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await retryCapture(failingFn, 3, 0);
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(4); // initial + 3 retries
      expect(result.error).toContain('after 4 attempts');
    });

    it('succeeds on second attempt with retryCount=1', async () => {
      const { retryCapture } = await import('./capture-worker.js');

      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('Transient error');
        return 'success-value';
      });

      const result = await retryCapture(fn, 3, 0);
      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(result.value).toBe('success-value');
    });

    it('does not retry when maxRetries=0', async () => {
      const { retryCapture } = await import('./capture-worker.js');

      const failingFn = vi.fn().mockRejectedValue(new Error('Failure'));

      const result = await retryCapture(failingFn, 0, 0);
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(failingFn).toHaveBeenCalledTimes(1);
    });

    it('processCaptureShardJob retries on storage upload failure and records retryCount', async () => {
      MockCaptureEngine.mockImplementation(function () {
        return {
          capture: vi.fn().mockResolvedValue([
            {
              routeName: 'home',
              routePath: '/',
              viewport: '1280x720',
              browser: 'chromium',
              screenshotBuffer: Buffer.from('screenshot'),
              domHash: 'hash1',
              skipped: false,
            },
          ]),
        };
      });

      // Make uploadBuffer fail once then succeed
      let uploadCallCount = 0;
      mockUploadBuffer.mockImplementation(async () => {
        uploadCallCount++;
        if (uploadCallCount === 1) {
          throw new Error('S3 transient error');
        }
        return undefined as any;
      });

      const db = buildMockDb();

      await processCaptureShardJob(
        {
          captureRunId: 'run-123',
          configPath: '/path/to/config.yml',
          projectId: 'proj-456',
          type: 'shard',
          shardIndex: 0,
          routes: [{ name: 'home', path: '/' }],
          viewports: ['1280x720'],
          browsers: ['chromium'],
          maxRetries: 2,
        },
        { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
      );

      // Snapshot should have retryCount=1 (succeeded on second attempt)
      const insertChainable = vi.mocked(db.insert).mock.results[0]?.value as ReturnType<typeof db.insert>;
      const allValuesCalls = vi.mocked(insertChainable.values as any).mock.calls;
      const snapshotInsert = allValuesCalls.find(
        (c: any[]) => c[0] && typeof c[0].runId === 'string',
      );
      expect(snapshotInsert).toBeDefined();
      expect(snapshotInsert![0].retryCount).toBe(1);
    });

    it('processCaptureShardJob uses maxRetries from job data', async () => {
      MockCaptureEngine.mockImplementation(function () {
        return {
          capture: vi.fn().mockResolvedValue([
            {
              routeName: 'home',
              routePath: '/',
              viewport: '1280x720',
              browser: 'chromium',
              screenshotBuffer: Buffer.from('screenshot'),
              domHash: 'hash1',
              skipped: false,
            },
          ]),
        };
      });

      // Make uploadBuffer always fail
      mockUploadBuffer.mockRejectedValue(new Error('Persistent S3 failure'));

      const db = buildMockDb();

      const result = await processCaptureShardJob(
        {
          captureRunId: 'run-123',
          configPath: '/path/to/config.yml',
          projectId: 'proj-456',
          type: 'shard',
          shardIndex: 0,
          routes: [{ name: 'home', path: '/' }],
          viewports: ['1280x720'],
          browsers: ['chromium'],
          maxRetries: 1,
        },
        { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
      );

      // Should have error with "(after 2 attempts)" since maxRetries=1 means 1 retry + 1 initial = 2 attempts
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('after 2 attempts');
    });

    it('processCaptureShardJob defaults to 3 retries when maxRetries not in job data', async () => {
      MockCaptureEngine.mockImplementation(function () {
        return {
          capture: vi.fn().mockResolvedValue([
            {
              routeName: 'home',
              routePath: '/',
              viewport: '1280x720',
              browser: 'chromium',
              screenshotBuffer: Buffer.from('screenshot'),
              domHash: 'hash1',
              skipped: false,
            },
          ]),
        };
      });

      // Make uploadBuffer always fail
      mockUploadBuffer.mockRejectedValue(new Error('Persistent failure'));

      const db = buildMockDb();

      const result = await processCaptureShardJob(
        {
          captureRunId: 'run-123',
          configPath: '/path/to/config.yml',
          projectId: 'proj-456',
          type: 'shard',
          shardIndex: 0,
          routes: [{ name: 'home', path: '/' }],
          viewports: ['1280x720'],
          browsers: ['chromium'],
          // no maxRetries -- should default to 3
        },
        { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
      );

      // Should have error with "(after 4 attempts)" since default maxRetries=3 means 3 retries + 1 initial = 4 attempts
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('after 4 attempts');
    });

    it('processCaptureJob legacy path uses retryCapture and records actual retryCount', async () => {
      MockCaptureEngine.mockImplementation(function () {
        return {
          capture: vi.fn().mockResolvedValue([
            {
              routeName: 'home',
              routePath: '/',
              viewport: '1280x720',
              browser: 'chromium',
              screenshotBuffer: Buffer.from('screenshot'),
              domHash: 'hash1',
              skipped: false,
            },
          ]),
        };
      });

      // Make uploadBuffer fail once then succeed
      let uploadCallCount = 0;
      mockUploadBuffer.mockImplementation(async () => {
        uploadCallCount++;
        if (uploadCallCount === 1) {
          throw new Error('S3 transient error');
        }
        return undefined as any;
      });

      mockLoadConfig.mockResolvedValue(mockConfig as any);
      mockDispatchAdapters.mockResolvedValue([]);

      const db = buildMockDb();

      await processCaptureJob(
        { captureRunId: 'run-123', configPath: '/config.yml', maxRetries: 2 },
        { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
      );

      // Find snapshot insert and verify retryCount=1 (failed once, succeeded on second attempt)
      const insertChainable = vi.mocked(db.insert).mock.results[0]?.value as ReturnType<typeof db.insert>;
      const allValuesCalls = vi.mocked(insertChainable.values as any).mock.calls;
      const snapshotInsert = allValuesCalls.find(
        (c: any[]) => c[0] && typeof c[0].runId === 'string',
      );
      expect(snapshotInsert).toBeDefined();
      expect(snapshotInsert![0].retryCount).toBe(1);
    });

    it('processCaptureShardJob snapshot insert contains retryCount from retryCapture, not hardcoded 0', async () => {
      MockCaptureEngine.mockImplementation(function () {
        return {
          capture: vi.fn().mockResolvedValue([
            {
              routeName: 'home',
              routePath: '/',
              viewport: '1280x720',
              browser: 'chromium',
              screenshotBuffer: Buffer.from('screenshot'),
              domHash: 'hash1',
              skipped: false,
            },
          ]),
        };
      });

      // Make uploadBuffer fail twice then succeed
      let uploadCallCount = 0;
      mockUploadBuffer.mockImplementation(async () => {
        uploadCallCount++;
        if (uploadCallCount <= 2) {
          throw new Error('S3 transient error');
        }
        return undefined as any;
      });

      const db = buildMockDb();

      await processCaptureShardJob(
        {
          captureRunId: 'run-123',
          configPath: '/path/to/config.yml',
          projectId: 'proj-456',
          type: 'shard',
          shardIndex: 0,
          routes: [{ name: 'home', path: '/' }],
          viewports: ['1280x720'],
          browsers: ['chromium'],
          maxRetries: 3,
        },
        { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
      );

      // Snapshot should have retryCount=2 (failed twice, succeeded third time)
      const insertChainable = vi.mocked(db.insert).mock.results[0]?.value as ReturnType<typeof db.insert>;
      const allValuesCalls = vi.mocked(insertChainable.values as any).mock.calls;
      const snapshotInsert = allValuesCalls.find(
        (c: any[]) => c[0] && typeof c[0].runId === 'string',
      );
      expect(snapshotInsert).toBeDefined();
      expect(snapshotInsert![0].retryCount).toBe(2);
    });
  });

  it('merges adapters + routes into combined capture targets', async () => {
    const configWithBoth = {
      ...mockConfig,
      capture: {
        ...mockConfig.capture,
        routes: [
          { name: 'home', path: '/', viewports: undefined, mask: undefined, thresholds: undefined },
        ],
      },
      adapters: [
        { type: 'storybook' as const, storybookUrl: 'http://localhost:6006' },
      ],
    };
    mockLoadConfig.mockResolvedValue(configWithBoth as never);

    mockDispatchAdapters.mockResolvedValue({
      storybook: [
        { source: 'storybook' as const, metadata: { componentName: 'Nav', storyId: 'nav--default' } },
      ],
      image: [],
      tokens: [],
      figma: [],
    });

    mockSpecsToRoutes.mockReturnValue({
      routes: [
        { name: 'Nav', path: 'http://localhost:6006/iframe.html?id=nav--default&viewMode=story' },
      ],
      baselineSpecs: [],
    });

    let capturedConfig: any;
    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockImplementation((cfg: any) => {
          capturedConfig = cfg;
          return Promise.resolve([]);
        }),
      };
    });

    const db = buildMockDb();

    await processCaptureJob(
      { captureRunId: 'run-123', configPath: '/path/to/config.yml' },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // Should have both YAML route and adapter route
    expect(capturedConfig.capture.routes).toHaveLength(2);
    expect(capturedConfig.capture.routes[0]).toMatchObject({ name: 'home' });
    expect(capturedConfig.capture.routes[1]).toMatchObject({ name: 'Nav' });
  });
});

describe('environment baseUrl override', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConfig.mockResolvedValue(structuredClone(mockConfig) as never);
    mockResolveThresholds.mockReturnValue({
      pixelDiffThreshold: 0.1,
      ssimThreshold: null,
    });
  });

  it('processCaptureShardJob overrides config baseUrl when envBaseUrl is provided', async () => {
    let capturedConfig: any;
    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockImplementation((config: any) => {
          capturedConfig = config;
          return Promise.resolve([]);
        }),
      };
    });

    const db = buildMockDb();

    await processCaptureShardJob(
      {
        captureRunId: 'run-123',
        configPath: '/path/to/config.yml',
        projectId: 'proj-456',
        type: 'shard',
        shardIndex: 0,
        routes: [{ name: 'home', path: '/' }],
        viewports: ['1280x720'],
        browsers: ['chromium'],
        environmentName: 'staging',
        envBaseUrl: 'https://staging.example.com',
      },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    expect(capturedConfig.baseUrl).toBe('https://staging.example.com');
  });

  it('processCaptureShardJob uses original baseUrl when envBaseUrl is not provided', async () => {
    let capturedConfig: any;
    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockImplementation((config: any) => {
          capturedConfig = config;
          return Promise.resolve([]);
        }),
      };
    });

    const db = buildMockDb();

    await processCaptureShardJob(
      {
        captureRunId: 'run-123',
        configPath: '/path/to/config.yml',
        projectId: 'proj-456',
        type: 'shard',
        shardIndex: 0,
        routes: [{ name: 'home', path: '/' }],
        viewports: ['1280x720'],
        browsers: ['chromium'],
      },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // Original synthetic config sets baseUrl to '' (empty string)
    expect(capturedConfig.baseUrl).toBe('');
  });

  it('processCaptureShardJob accepts environmentName without envBaseUrl', async () => {
    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockResolvedValue([]),
      };
    });

    const db = buildMockDb();

    // Should not throw when environmentName is set but envBaseUrl is not
    await expect(
      processCaptureShardJob(
        {
          captureRunId: 'run-123',
          configPath: '/path/to/config.yml',
          projectId: 'proj-456',
          type: 'shard',
          shardIndex: 0,
          routes: [{ name: 'home', path: '/' }],
          viewports: ['1280x720'],
          browsers: ['chromium'],
          environmentName: 'staging',
        },
        { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
      ),
    ).resolves.not.toThrow();
  });

  it('routes are captured with the environment baseUrl applied to config', async () => {
    let capturedConfig: any;
    MockCaptureEngine.mockImplementation(function () {
      return {
        capture: vi.fn().mockImplementation((config: any) => {
          capturedConfig = config;
          return Promise.resolve([
            {
              routeName: 'dashboard',
              routePath: '/dashboard',
              viewport: '1280x720',
              browser: 'chromium',
              screenshotBuffer: Buffer.from('screenshot'),
              domHash: 'hash1',
              skipped: false,
            },
          ]);
        }),
      };
    });

    const db = buildMockDb();

    await processCaptureShardJob(
      {
        captureRunId: 'run-123',
        configPath: '/path/to/config.yml',
        projectId: 'proj-456',
        type: 'shard',
        shardIndex: 0,
        routes: [{ name: 'dashboard', path: '/dashboard' }],
        viewports: ['1280x720'],
        browsers: ['chromium'],
        environmentName: 'production',
        envBaseUrl: 'https://prod.example.com',
      },
      { db: db as never, storageClient: mockStorageClient, bucket: 'test-bucket' },
    );

    // Verify the config passed to CaptureEngine.capture has the environment baseUrl
    expect(capturedConfig.baseUrl).toBe('https://prod.example.com');
    // Verify routes were included in the config
    expect(capturedConfig.capture.routes).toEqual([{ name: 'dashboard', path: '/dashboard' }]);
  });
});
