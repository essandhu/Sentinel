import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const mockComputeShardPlan = vi.hoisted(() => vi.fn());
const mockGetFlowProducer = vi.hoisted(() => vi.fn());
const mockProcessCaptureJob = vi.hoisted(() => vi.fn());
const mockProcessCaptureShardJob = vi.hoisted(() => vi.fn());
const mockExpandParameterMatrix = vi.hoisted(() => vi.fn());
const mockExpandBoundaryViewports = vi.hoisted(() => vi.fn());
const mockCreateDb = vi.hoisted(() => vi.fn());
const mockLoadConfig = vi.hoisted(() => vi.fn());
const mockSendPostJobNotifications = vi.hoisted(() => vi.fn());
const mockProcessFigmaResyncJob = vi.hoisted(() => vi.fn());
const mockCreateStorageClient = vi.hoisted(() => vi.fn());

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('../src/shard-plan.js', () => ({
  computeShardPlan: mockComputeShardPlan,
}));

vi.mock('../src/queue.js', () => ({
  getFlowProducer: mockGetFlowProducer,
  QUEUE_NAME: 'capture',
}));

vi.mock('@sentinel-vrt/capture', () => ({
  processCaptureJob: mockProcessCaptureJob,
  processCaptureShardJob: mockProcessCaptureShardJob,
  loadConfig: mockLoadConfig,
  expandParameterMatrix: mockExpandParameterMatrix,
  expandBoundaryViewports: mockExpandBoundaryViewports,
  clearPluginsForRun: vi.fn(),
  loadAllPlugins: vi.fn().mockResolvedValue([]),
  setPluginsForRun: vi.fn(),
  PluginHookRunner: vi.fn().mockImplementation(() => ({
    beforeCapture: vi.fn().mockResolvedValue(undefined),
    afterDiff: vi.fn().mockResolvedValue(undefined),
    onApproval: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@sentinel-vrt/db', () => ({
  createDb: mockCreateDb,
  captureRuns: { id: 'captureRuns.id', shardCount: 'captureRuns.shardCount', totalRoutes: 'captureRuns.totalRoutes', status: 'captureRuns.status', completedAt: 'captureRuns.completedAt' },
  breakpointPresets: { projectId: 'breakpointPresets.projectId' },
  projects: { id: 'projects.id', boundaryTestingEnabled: 'projects.boundaryTestingEnabled' },
}));

vi.mock('@sentinel-vrt/storage', () => ({
  createStorageClient: mockCreateStorageClient,
}));

vi.mock('../src/services/post-job-notifications.js', () => ({
  sendPostJobNotifications: mockSendPostJobNotifications,
}));

vi.mock('../src/workers/figma-resync.js', () => ({
  processFigmaResyncJob: mockProcessFigmaResyncJob,
}));

// Import the processor function that we will extract from the worker module
// We need to test the job discrimination logic directly
import { createJobProcessor } from '../src/workers/index.js';

describe('Worker job discrimination', () => {
  let processor: ReturnType<typeof createJobProcessor>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDb.mockReturnValue(mockDb);
    mockCreateStorageClient.mockReturnValue({});
    processor = createJobProcessor();
  });

  function makeJob(overrides: Record<string, unknown> = {}) {
    return {
      name: overrides.name ?? 'capture',
      data: overrides.data ?? {},
      id: overrides.id ?? 'job-1',
      updateProgress: vi.fn().mockResolvedValue(undefined),
      getChildrenValues: vi.fn().mockResolvedValue({}),
      getFailedChildrenValues: vi.fn().mockResolvedValue({}),
      returnvalue: overrides.returnvalue ?? undefined,
    };
  }

  it('Test 1: capture-plan job calls plan handler (loads config, creates FlowProducer flow)', async () => {
    const mockFlowAdd = vi.fn().mockResolvedValue({});
    mockGetFlowProducer.mockReturnValue({ add: mockFlowAdd });
    mockLoadConfig.mockResolvedValue({
      capture: {
        routes: [
          { name: 'home', path: '/home' },
          { name: 'about', path: '/about' },
        ],
        viewports: ['1280x720'],
      },
      browsers: ['chromium'],
    });
    mockExpandParameterMatrix.mockReturnValue({
      routes: [
        { name: 'home', path: '/home', parameterName: null, parameterValues: {} },
        { name: 'about', path: '/about', parameterName: null, parameterValues: {} },
      ],
      totalCaptures: 2,
      truncated: false,
    });
    mockComputeShardPlan.mockReturnValue({
      shards: [
        { routes: [{ name: 'home', path: '/home' }], viewports: ['1280x720'], browsers: ['chromium'] },
        { routes: [{ name: 'about', path: '/about' }], viewports: ['1280x720'], browsers: ['chromium'] },
      ],
      totalCaptures: 2,
      shardCount: 2,
    });

    // Mock DB update chain
    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update.mockReturnValue({ set: mockSet });
    // Mock DB select for breakpoint presets
    const mockOrderBy = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const job = makeJob({
      name: 'capture-plan',
      data: {
        captureRunId: 'run-1',
        configPath: '/path/to/config.yml',
        projectId: 'proj-1',
      },
    });

    await processor(job as any);

    expect(mockLoadConfig).toHaveBeenCalledWith('/path/to/config.yml');
    expect(mockComputeShardPlan).toHaveBeenCalled();
    expect(mockFlowAdd).toHaveBeenCalled();
    // Should NOT call legacy processCaptureJob
    expect(mockProcessCaptureJob).not.toHaveBeenCalled();
  });

  it('Test 2: shard job calls processCaptureShardJob with correct route subset', async () => {
    mockProcessCaptureShardJob.mockResolvedValue({ snapshotCount: 5, errors: [] });

    const job = makeJob({
      name: 'capture-shard',
      data: {
        type: 'shard',
        captureRunId: 'run-1',
        shardIndex: 0,
        routes: [{ name: 'home', path: '/home' }],
        viewports: ['1280x720'],
        browsers: ['chromium'],
        configPath: '/path/to/config.yml',
        projectId: 'proj-1',
      },
    });

    await processor(job as any);

    expect(mockProcessCaptureShardJob).toHaveBeenCalledWith(
      job.data,
      expect.objectContaining({
        db: mockDb,
        onProgress: expect.any(Function),
      }),
    );
    expect(mockProcessCaptureJob).not.toHaveBeenCalled();
  });

  it('Test 3: aggregate job calls getChildrenValues', async () => {
    const job = makeJob({
      name: 'capture-aggregate',
      data: {
        type: 'aggregate',
        captureRunId: 'run-1',
        totalCaptures: 10,
      },
    });
    job.getChildrenValues.mockResolvedValue({
      'child-1': { snapshotCount: 5, errors: [] },
      'child-2': { snapshotCount: 5, errors: [] },
    });
    job.getFailedChildrenValues.mockResolvedValue({});

    // Mock DB update chain
    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update.mockReturnValue({ set: mockSet });

    await processor(job as any);

    expect(job.getChildrenValues).toHaveBeenCalled();
    expect(job.getFailedChildrenValues).toHaveBeenCalled();
  });

  it('Test 4: aggregate handler marks run completed when no failed children', async () => {
    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.update.mockReturnValue({ set: mockSet });

    const job = makeJob({
      name: 'capture-aggregate',
      data: {
        type: 'aggregate',
        captureRunId: 'run-1',
        totalCaptures: 10,
      },
    });
    job.getChildrenValues.mockResolvedValue({
      'child-1': { snapshotCount: 5, errors: [] },
    });
    job.getFailedChildrenValues.mockResolvedValue({});

    const result = await processor(job as any);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
    expect(result).toEqual(expect.objectContaining({ type: 'aggregate', status: 'completed' }));
  });

  it('Test 5: aggregate handler marks run partial when some children failed (SHARD-02)', async () => {
    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.update.mockReturnValue({ set: mockSet });

    const job = makeJob({
      name: 'capture-aggregate',
      data: {
        type: 'aggregate',
        captureRunId: 'run-1',
        totalCaptures: 10,
      },
    });
    job.getChildrenValues.mockResolvedValue({
      'child-1': { snapshotCount: 5, errors: [] },
    });
    job.getFailedChildrenValues.mockResolvedValue({
      'child-2': 'Timeout exceeded',
    });

    const result = await processor(job as any);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'partial' }),
    );
    expect(result).toEqual(expect.objectContaining({ type: 'aggregate', status: 'partial' }));
  });

  it('Test 6: job without type field falls back to legacy processCaptureJob', async () => {
    mockProcessCaptureJob.mockResolvedValue(undefined);

    const job = makeJob({
      name: 'capture',
      data: {
        captureRunId: 'run-legacy',
        configPath: '/path/to/config.yml',
      },
    });

    await processor(job as any);

    expect(mockProcessCaptureJob).toHaveBeenCalledWith(
      job.data,
      expect.objectContaining({
        db: mockDb,
        onProgress: expect.any(Function),
      }),
    );
    expect(mockProcessCaptureShardJob).not.toHaveBeenCalled();
  });

  it('Test 7: when boundaryTestingEnabled=1 and presets exist, shard plan viewports include -1px variants', async () => {
    const mockFlowAdd = vi.fn().mockResolvedValue({});
    mockGetFlowProducer.mockReturnValue({ add: mockFlowAdd });
    mockLoadConfig.mockResolvedValue({
      capture: {
        routes: [{ name: 'home', path: '/home' }],
        viewports: ['1280x720'],
      },
      browsers: ['chromium'],
      boundaryTesting: { enabled: false },
    });
    mockExpandParameterMatrix.mockReturnValue({
      routes: [{ name: 'home', path: '/home', parameterName: null, parameterValues: {} }],
      totalCaptures: 1,
      truncated: false,
    });
    mockComputeShardPlan.mockReturnValue({
      shards: [{ routes: [{ name: 'home', path: '/home' }], viewports: ['639x480', '640x480'], browsers: ['chromium'] }],
      totalCaptures: 2,
      shardCount: 1,
    });
    mockExpandBoundaryViewports.mockReturnValue({
      viewports: [
        { viewport: '639x480', breakpointName: 'sm-1px', isBoundary: true, parentBreakpoint: 'sm' },
        { viewport: '640x480', breakpointName: 'sm', isBoundary: false, parentBreakpoint: 'sm' },
      ],
      totalViewportCount: 2,
    });

    // Mock DB update chain
    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update.mockReturnValue({ set: mockSet });

    // Mock DB select: first call for breakpoint presets (returns presets), second for project boundary flag
    const mockLimit = vi.fn().mockResolvedValue([{ boundaryTestingEnabled: 1 }]);
    const mockPresetOrderBy = vi.fn().mockResolvedValue([{ name: 'sm', width: 640, height: 480, sortOrder: 0 }]);
    const mockPresetWhere = vi.fn().mockReturnValue({ orderBy: mockPresetOrderBy });
    const mockProjectWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn()
      .mockReturnValueOnce({ where: mockPresetWhere }) // breakpointPresets
      .mockReturnValueOnce({ where: mockProjectWhere }); // projects
    mockDb.select.mockReturnValue({ from: mockFrom });

    const job = makeJob({
      name: 'capture-plan',
      data: {
        captureRunId: 'run-1',
        configPath: '/path/to/config.yml',
        projectId: 'proj-1',
      },
    });

    await processor(job as any);

    // expandBoundaryViewports should have been called since project has boundary enabled
    expect(mockExpandBoundaryViewports).toHaveBeenCalledWith(
      [{ name: 'sm', width: 640, height: 480 }],
      'below',
    );
  });

  it('Test 8: when boundaryTestingEnabled=0, viewports are unchanged (no boundary expansion)', async () => {
    const mockFlowAdd = vi.fn().mockResolvedValue({});
    mockGetFlowProducer.mockReturnValue({ add: mockFlowAdd });
    mockLoadConfig.mockResolvedValue({
      capture: {
        routes: [{ name: 'home', path: '/home' }],
        viewports: ['1280x720'],
      },
      browsers: ['chromium'],
    });
    mockExpandParameterMatrix.mockReturnValue({
      routes: [{ name: 'home', path: '/home', parameterName: null, parameterValues: {} }],
      totalCaptures: 1,
      truncated: false,
    });
    mockComputeShardPlan.mockReturnValue({
      shards: [{ routes: [{ name: 'home', path: '/home' }], viewports: ['640x480'], browsers: ['chromium'] }],
      totalCaptures: 1,
      shardCount: 1,
    });

    // Mock DB update chain
    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update.mockReturnValue({ set: mockSet });

    // Mock: presets exist but project has boundary disabled
    const mockLimit = vi.fn().mockResolvedValue([{ boundaryTestingEnabled: 0 }]);
    const mockPresetOrderBy = vi.fn().mockResolvedValue([{ name: 'sm', width: 640, height: 480, sortOrder: 0 }]);
    const mockPresetWhere = vi.fn().mockReturnValue({ orderBy: mockPresetOrderBy });
    const mockProjectWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn()
      .mockReturnValueOnce({ where: mockPresetWhere }) // breakpointPresets
      .mockReturnValueOnce({ where: mockProjectWhere }); // projects
    mockDb.select.mockReturnValue({ from: mockFrom });

    const job = makeJob({
      name: 'capture-plan',
      data: {
        captureRunId: 'run-1',
        configPath: '/path/to/config.yml',
        projectId: 'proj-1',
      },
    });

    await processor(job as any);

    // expandBoundaryViewports should NOT have been called
    expect(mockExpandBoundaryViewports).not.toHaveBeenCalled();
  });

  it('Test 9: suite-level boundaryTesting=false override prevents expansion even when project-level is enabled', async () => {
    const mockFlowAdd = vi.fn().mockResolvedValue({});
    mockGetFlowProducer.mockReturnValue({ add: mockFlowAdd });
    mockLoadConfig.mockResolvedValue({
      capture: {
        routes: [{ name: 'home', path: '/home' }],
        viewports: ['1280x720'],
      },
      browsers: ['chromium'],
      suites: {
        smoke: { routes: ['/home'], boundaryTesting: false },
      },
    });
    mockExpandParameterMatrix.mockReturnValue({
      routes: [{ name: 'home', path: '/home', parameterName: null, parameterValues: {} }],
      totalCaptures: 1,
      truncated: false,
    });
    mockComputeShardPlan.mockReturnValue({
      shards: [{ routes: [{ name: 'home', path: '/home' }], viewports: ['640x480'], browsers: ['chromium'] }],
      totalCaptures: 1,
      shardCount: 1,
    });

    // Mock DB update chain
    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update.mockReturnValue({ set: mockSet });

    // Project has boundary enabled
    const mockLimit = vi.fn().mockResolvedValue([{ boundaryTestingEnabled: 1 }]);
    const mockPresetOrderBy = vi.fn().mockResolvedValue([{ name: 'sm', width: 640, height: 480, sortOrder: 0 }]);
    const mockPresetWhere = vi.fn().mockReturnValue({ orderBy: mockPresetOrderBy });
    const mockProjectWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn()
      .mockReturnValueOnce({ where: mockPresetWhere })
      .mockReturnValueOnce({ where: mockProjectWhere });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const job = makeJob({
      name: 'capture-plan',
      data: {
        captureRunId: 'run-1',
        configPath: '/path/to/config.yml',
        projectId: 'proj-1',
        suiteName: 'smoke', // Suite with boundaryTesting=false
      },
    });

    await processor(job as any);

    // expandBoundaryViewports should NOT have been called due to suite override
    expect(mockExpandBoundaryViewports).not.toHaveBeenCalled();
  });

  it('Test 10: shard job reports progress with shardIndex included', async () => {
    mockProcessCaptureShardJob.mockImplementation(async (_data: any, deps: any) => {
      // Simulate the shard job calling onProgress
      deps.onProgress({ current: 1, total: 5, routeName: '/home', captureRunId: 'run-1' });
      return { snapshotCount: 5, errors: [] };
    });

    const job = makeJob({
      name: 'capture-shard',
      data: {
        type: 'shard',
        captureRunId: 'run-1',
        shardIndex: 2,
        routes: [{ name: 'home', path: '/home' }],
        viewports: ['1280x720'],
        browsers: ['chromium'],
        configPath: '/path/to/config.yml',
        projectId: 'proj-1',
      },
    });

    await processor(job as any);

    // The onProgress should have been called with shardIndex injected
    expect(job.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({ shardIndex: 2 }),
    );
  });
});
