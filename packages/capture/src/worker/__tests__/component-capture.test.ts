import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@sentinel/db', () => ({
  components: {
    id: 'components.id',
    projectId: 'components.projectId',
    name: 'components.name',
    selector: 'components.selector',
    enabled: 'components.enabled',
  },
  snapshots: {
    id: 'snapshots.id',
    runId: 'snapshots.runId',
    url: 'snapshots.url',
    viewport: 'snapshots.viewport',
    s3Key: 'snapshots.s3Key',
    componentId: 'snapshots.componentId',
    domHash: 'snapshots.domHash',
    capturedAt: 'snapshots.capturedAt',
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.projectId',
  },
  diffReports: {},
  baselines: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  desc: vi.fn((col) => ({ _type: 'desc', col })),
}));

vi.mock('@sentinel/storage', () => ({
  uploadBuffer: vi.fn().mockResolvedValue(undefined),
  downloadBuffer: vi.fn().mockResolvedValue(Buffer.from('fake')),
  StorageKeys: {
    capture: vi.fn((runId: string, snapId: string) => `captures/${runId}/${snapId}/captured.png`),
    baseline: vi.fn((projId: string, snapId: string) => `baselines/${projId}/${snapId}/baseline.png`),
    diff: vi.fn((runId: string, snapId: string) => `diffs/${runId}/${snapId}/diff.png`),
  },
  createStorageClient: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid-1234'),
}));

import { captureComponentScreenshots } from '../capture-worker.js';

describe('component capture', () => {
  let mockDb: any;
  let mockStorageClient: any;
  let mockPage: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStorageClient = {};

    mockPage = {
      locator: vi.fn(),
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
    };
  });

  function createMockDb(componentRows: any[] = []) {
    const mockValues = vi.fn().mockResolvedValue([{ id: 'snap-new' }]);
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

    // select chain for component query
    const mockWhere = vi.fn().mockResolvedValue(componentRows);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    return {
      select: mockSelect,
      insert: mockInsert,
      _mockWhere: mockWhere,
      _mockValues: mockValues,
    };
  }

  it('captures element screenshots when components exist for project', async () => {
    const componentRows = [
      { id: 'comp-1', projectId: 'proj-1', name: 'Button', selector: '.btn-primary', enabled: 1 },
    ];

    mockDb = createMockDb(componentRows);

    const mockLocator = {
      count: vi.fn().mockResolvedValue(1),
      first: vi.fn().mockReturnValue({
        screenshot: vi.fn().mockResolvedValue(Buffer.from('element-screenshot')),
      }),
    };
    mockPage.locator.mockReturnValue(mockLocator);

    const capturedPages = [
      { routePath: '/home', viewport: '1280x720' },
    ];

    await captureComponentScreenshots({
      db: mockDb as any,
      storageClient: mockStorageClient,
      bucket: 'test-bucket',
      projectId: 'proj-1',
      captureRunId: 'run-1',
      capturedPages,
      page: mockPage,
    });

    // Should have queried components for this project
    expect(mockDb.select).toHaveBeenCalled();

    // Should have used locator with the component selector
    expect(mockPage.locator).toHaveBeenCalledWith('.btn-primary');

    // Should have taken a screenshot of the element
    expect(mockLocator.first().screenshot).toHaveBeenCalledWith({
      type: 'png',
      animations: 'disabled',
    });

    // Should have inserted a snapshot row with componentId set
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('skips missing selectors without error', async () => {
    const componentRows = [
      { id: 'comp-1', projectId: 'proj-1', name: 'Button', selector: '.does-not-exist', enabled: 1 },
    ];

    mockDb = createMockDb(componentRows);

    const mockLocator = {
      count: vi.fn().mockResolvedValue(0),
      first: vi.fn(),
    };
    mockPage.locator.mockReturnValue(mockLocator);

    const capturedPages = [
      { routePath: '/home', viewport: '1280x720' },
    ];

    // Should not throw
    await captureComponentScreenshots({
      db: mockDb as any,
      storageClient: mockStorageClient,
      bucket: 'test-bucket',
      projectId: 'proj-1',
      captureRunId: 'run-1',
      capturedPages,
      page: mockPage,
    });

    // Should have checked locator count
    expect(mockLocator.count).toHaveBeenCalled();

    // Should NOT have tried to take a screenshot
    expect(mockLocator.first).not.toHaveBeenCalled();

    // Should NOT have inserted any snapshot rows
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('component capture failure does not throw (belt-and-suspenders)', async () => {
    const componentRows = [
      { id: 'comp-1', projectId: 'proj-1', name: 'Button', selector: '.btn', enabled: 1 },
    ];

    mockDb = createMockDb(componentRows);

    // Locator exists but screenshot throws
    const mockLocator = {
      count: vi.fn().mockResolvedValue(1),
      first: vi.fn().mockReturnValue({
        screenshot: vi.fn().mockRejectedValue(new Error('Element detached')),
      }),
    };
    mockPage.locator.mockReturnValue(mockLocator);

    const capturedPages = [
      { routePath: '/home', viewport: '1280x720' },
    ];

    // Should NOT throw -- errors are caught internally
    await expect(
      captureComponentScreenshots({
        db: mockDb as any,
        storageClient: mockStorageClient,
        bucket: 'test-bucket',
        projectId: 'proj-1',
        captureRunId: 'run-1',
        capturedPages,
        page: mockPage,
      }),
    ).resolves.not.toThrow();
  });

  it('no component queries when project has no registered components', async () => {
    // No components returned
    mockDb = createMockDb([]);

    const capturedPages = [
      { routePath: '/home', viewport: '1280x720' },
    ];

    await captureComponentScreenshots({
      db: mockDb as any,
      storageClient: mockStorageClient,
      bucket: 'test-bucket',
      projectId: 'proj-1',
      captureRunId: 'run-1',
      capturedPages,
      page: mockPage,
    });

    // Should have queried for components but found none
    expect(mockDb.select).toHaveBeenCalledTimes(1);

    // Should NOT have tried to use locators
    expect(mockPage.locator).not.toHaveBeenCalled();

    // Should NOT have inserted any snapshot rows
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
