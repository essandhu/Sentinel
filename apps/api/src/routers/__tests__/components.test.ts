import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sentinel-vrt/db before importing router
vi.mock('@sentinel-vrt/db', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return {
    createDb: vi.fn(() => mockDb),
    projects: { id: 'projects.id', workspaceId: 'projects.workspaceId' },
    components: {
      id: 'components.id',
      projectId: 'components.projectId',
      name: 'components.name',
      selector: 'components.selector',
      description: 'components.description',
      enabled: 'components.enabled',
      createdAt: 'components.createdAt',
      updatedAt: 'components.updatedAt',
    },
    snapshots: {
      id: 'snapshots.id',
      componentId: 'snapshots.componentId',
      url: 'snapshots.url',
      s3Key: 'snapshots.s3Key',
      viewport: 'snapshots.viewport',
      runId: 'snapshots.runId',
      capturedAt: 'snapshots.capturedAt',
    },
    captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId' },
  };
});

const mockDownloadBuffer = vi.fn();
vi.mock('@sentinel-vrt/storage', () => ({
  createStorageClient: vi.fn(() => ({})),
  downloadBuffer: (...args: unknown[]) => mockDownloadBuffer(...args),
}));

const mockRunDualDiff = vi.fn();
vi.mock('@sentinel-vrt/capture', () => ({
  runDualDiff: (...args: unknown[]) => mockRunDualDiff(...args),
}));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
}));

describe('components router', () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createDb } = await import('@sentinel-vrt/db');
    mockDb = (createDb as ReturnType<typeof vi.fn>)();
  });

  function setupProjectOwnership(result: any[] = [{ id: 'proj-1' }]) {
    const mockWhere = vi.fn().mockResolvedValue(result);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.select.mockReturnValue({ from: mockFrom });
    return mockWhere;
  }

  function setupComponentOwnership(result: any[] = [{ id: 'comp-1', projectId: 'proj-1' }]) {
    const mockWhere = vi.fn().mockResolvedValue(result);
    const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
    const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
    mockDb.select.mockReturnValue({ from: mockFrom });
    return mockWhere;
  }

  describe('create', () => {
    it('inserts a component and returns the new row', async () => {
      const newComponent = {
        id: 'comp-1',
        projectId: 'proj-1',
        name: 'Primary Button',
        selector: '.btn-primary',
        description: null,
        enabled: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock project ownership check: select().from().where()
      const mockOwnershipWhere = vi.fn().mockResolvedValue([{ id: 'proj-1' }]);
      const mockOwnershipFrom = vi.fn().mockReturnValue({ where: mockOwnershipWhere });

      mockDb.select.mockReturnValue({ from: mockOwnershipFrom });

      // Mock insert().values().returning()
      const mockReturning = vi.fn().mockResolvedValue([newComponent]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.components.create({
        projectId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        name: 'Primary Button',
        selector: '.btn-primary',
      });

      expect(result).toEqual(newComponent);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('rejects empty name (min 1 char)', async () => {
      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      await expect(
        caller.components.create({
          projectId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          name: '',
          selector: '.btn',
        }),
      ).rejects.toThrow();
    });

    it('rejects empty selector (min 1 char)', async () => {
      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      await expect(
        caller.components.create({
          projectId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          name: 'Button',
          selector: '',
        }),
      ).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('returns components belonging to the given projectId within workspace', async () => {
      const componentsList = [
        { id: 'comp-1', name: 'Button', selector: '.btn', projectId: 'proj-1' },
        { id: 'comp-2', name: 'Header', selector: '.header', projectId: 'proj-1' },
      ];

      // First select: project ownership check
      const mockOwnershipWhere = vi.fn().mockResolvedValue([{ id: 'proj-1' }]);
      const mockOwnershipFrom = vi.fn().mockReturnValue({ where: mockOwnershipWhere });

      // Second select: component list
      const mockListWhere = vi.fn().mockResolvedValue(componentsList);
      const mockListFrom = vi.fn().mockReturnValue({ where: mockListWhere });

      mockDb.select
        .mockReturnValueOnce({ from: mockOwnershipFrom })
        .mockReturnValueOnce({ from: mockListFrom });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.components.list({
        projectId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });

      expect(result).toEqual(componentsList);
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });
  });

  describe('update', () => {
    it('updates name, selector, description, enabled status', async () => {
      const updatedComponent = {
        id: 'comp-1',
        name: 'Updated Button',
        selector: '.btn-updated',
        enabled: 0,
      };

      // Mock component ownership check (select with innerJoin)
      const mockOwnershipWhere = vi.fn().mockResolvedValue([{ id: 'comp-1', projectId: 'proj-1' }]);
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockOwnershipWhere });
      const mockOwnershipFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      mockDb.select.mockReturnValue({ from: mockOwnershipFrom });

      // Mock update().set().where().returning()
      const mockReturning = vi.fn().mockResolvedValue([updatedComponent]);
      const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      mockDb.update.mockReturnValue({ set: mockSet });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.components.update({
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        name: 'Updated Button',
        selector: '.btn-updated',
        enabled: 0,
      });

      expect(result).toEqual(updatedComponent);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete', () => {
    it('removes a component by id if it belongs to caller workspace', async () => {
      // Mock component ownership check (select with innerJoin)
      const mockOwnershipWhere = vi.fn().mockResolvedValue([{ id: 'comp-1', projectId: 'proj-1' }]);
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockOwnershipWhere });
      const mockOwnershipFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      mockDb.select.mockReturnValue({ from: mockOwnershipFrom });

      // Mock delete().where()
      const mockDeleteWhere = vi.fn().mockResolvedValue([]);
      mockDb.delete.mockReturnValue({ where: mockDeleteWhere });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.components.delete({
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });

      expect(result).toEqual({ success: true });
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('workspace isolation', () => {
    it('cannot access components from another workspace project (create)', async () => {
      // Mock project ownership check returns empty (project not in workspace)
      const mockOwnershipWhere = vi.fn().mockResolvedValue([]);
      const mockOwnershipFrom = vi.fn().mockReturnValue({ where: mockOwnershipWhere });
      mockDb.select.mockReturnValue({ from: mockOwnershipFrom });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      await expect(
        caller.components.create({
          projectId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          name: 'Evil',
          selector: '.evil',
        }),
      ).rejects.toThrow('Project not found in workspace');
    });

    it('cannot delete component from another workspace', async () => {
      // Mock component ownership check returns empty
      const mockOwnershipWhere = vi.fn().mockResolvedValue([]);
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockOwnershipWhere });
      const mockOwnershipFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      mockDb.select.mockReturnValue({ from: mockOwnershipFrom });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user-1', orgId: 'org-1', orgRole: 'org:admin' },
      } as any);

      await expect(
        caller.components.delete({
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        }),
      ).rejects.toThrow('Component not found in workspace');
    });
  });

  describe('consistency', () => {
    const PROJECT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    /**
     * Helper to set up DB mocks for the consistency endpoint.
     * The endpoint calls db.select() 4 times:
     *   1. verifyProjectOwnership: select().from().where()
     *   2. get enabled components: select().from().where()
     *   3. get component snapshots: select().from().where().orderBy()
     *   4. get project URLs: select().from().innerJoin().where()
     */
    function setupConsistencyMocks(opts: {
      enabledComponents: any[];
      componentSnapshots: any[];
      projectUrls: any[];
    }) {
      // 1. Project ownership check
      const ownershipWhere = vi.fn().mockResolvedValue([{ id: 'proj-1' }]);
      const ownershipFrom = vi.fn().mockReturnValue({ where: ownershipWhere });

      // 2. Enabled components
      const componentsWhere = vi.fn().mockResolvedValue(opts.enabledComponents);
      const componentsFrom = vi.fn().mockReturnValue({ where: componentsWhere });

      // 3. Component snapshots: select().from().where().orderBy()
      const snapshotsOrderBy = vi.fn().mockResolvedValue(opts.componentSnapshots);
      const snapshotsWhere = vi.fn().mockReturnValue({ orderBy: snapshotsOrderBy });
      const snapshotsFrom = vi.fn().mockReturnValue({ where: snapshotsWhere });

      // 4. Project URLs: select().from().innerJoin().where()
      const urlsWhere = vi.fn().mockResolvedValue(opts.projectUrls);
      const urlsInnerJoin = vi.fn().mockReturnValue({ where: urlsWhere });
      const urlsFrom = vi.fn().mockReturnValue({ innerJoin: urlsInnerJoin });

      mockDb.select
        .mockReturnValueOnce({ from: ownershipFrom })
        .mockReturnValueOnce({ from: componentsFrom })
        .mockReturnValueOnce({ from: snapshotsFrom })
        .mockReturnValueOnce({ from: urlsFrom });
    }

    beforeEach(() => {
      mockDownloadBuffer.mockReset();
      mockRunDualDiff.mockReset();
    });

    it('returns inconsistent when snapshots differ above threshold', async () => {
      setupConsistencyMocks({
        enabledComponents: [{ id: 'comp-1', name: 'Button', selector: '.btn', enabled: 1 }],
        componentSnapshots: [
          { id: 'snap-1', url: 'https://a.com', s3Key: 'captures/run1/snap1/captured.png', viewport: '1280x720', capturedAt: new Date() },
          { id: 'snap-2', url: 'https://b.com', s3Key: 'captures/run1/snap2/captured.png', viewport: '1280x720', capturedAt: new Date() },
        ],
        projectUrls: [
          { url: 'https://a.com' },
          { url: 'https://b.com' },
        ],
      });

      const bufferA = Buffer.from('image-a');
      const bufferB = Buffer.from('image-b');
      mockDownloadBuffer
        .mockResolvedValueOnce(bufferA)
        .mockResolvedValueOnce(bufferB);

      mockRunDualDiff.mockResolvedValue({
        passed: false,
        pixelDiffPercent: 5.2,
        ssimScore: 0.85,
        diffImageBuffer: Buffer.from('diff'),
        layers: { pixel: { diffPercent: 5.2, diffPixelCount: 1000 }, ssim: { score: 0.85 } },
      });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.components.consistency({ projectId: PROJECT_ID });

      expect(result).toHaveLength(1);
      const pages = result[0].pages;

      // Reference URL (alphabetically first) is always 'consistent'
      const pageA = pages.find((p: any) => p.url === 'https://a.com');
      expect(pageA?.status).toBe('consistent');

      // Second URL has diff that fails threshold => 'inconsistent'
      const pageB = pages.find((p: any) => p.url === 'https://b.com');
      expect(pageB?.status).toBe('inconsistent');

      expect(mockRunDualDiff).toHaveBeenCalledTimes(1);
    });

    it('returns consistent when snapshots are visually identical', async () => {
      setupConsistencyMocks({
        enabledComponents: [{ id: 'comp-1', name: 'Button', selector: '.btn', enabled: 1 }],
        componentSnapshots: [
          { id: 'snap-1', url: 'https://a.com', s3Key: 'captures/run1/snap1/captured.png', viewport: '1280x720', capturedAt: new Date() },
          { id: 'snap-2', url: 'https://b.com', s3Key: 'captures/run1/snap2/captured.png', viewport: '1280x720', capturedAt: new Date() },
        ],
        projectUrls: [
          { url: 'https://a.com' },
          { url: 'https://b.com' },
        ],
      });

      const bufferA = Buffer.from('image-identical');
      const bufferB = Buffer.from('image-identical');
      mockDownloadBuffer
        .mockResolvedValueOnce(bufferA)
        .mockResolvedValueOnce(bufferB);

      mockRunDualDiff.mockResolvedValue({
        passed: true,
        pixelDiffPercent: 0.01,
        ssimScore: 0.999,
        diffImageBuffer: Buffer.from('diff'),
        layers: { pixel: { diffPercent: 0.01, diffPixelCount: 2 }, ssim: { score: 0.999 } },
      });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.components.consistency({ projectId: PROJECT_ID });

      expect(result).toHaveLength(1);
      const pages = result[0].pages;

      expect(pages.every((p: any) => p.status === 'consistent')).toBe(true);
      expect(mockRunDualDiff).toHaveBeenCalledTimes(1);
    });

    it('returns missing for URLs where component has no snapshot', async () => {
      setupConsistencyMocks({
        enabledComponents: [{ id: 'comp-1', name: 'Button', selector: '.btn', enabled: 1 }],
        componentSnapshots: [
          { id: 'snap-1', url: 'https://a.com', s3Key: 'captures/run1/snap1/captured.png', viewport: '1280x720', capturedAt: new Date() },
        ],
        projectUrls: [
          { url: 'https://a.com' },
          { url: 'https://b.com' },
        ],
      });

      // Only one snapshot, so no comparison needed -- but https://b.com has no snapshot
      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.components.consistency({ projectId: PROJECT_ID });

      expect(result).toHaveLength(1);
      const pages = result[0].pages;

      const pageA = pages.find((p: any) => p.url === 'https://a.com');
      expect(pageA?.status).toBe('consistent');

      const pageB = pages.find((p: any) => p.url === 'https://b.com');
      expect(pageB?.status).toBe('missing');

      // No diff should be run when only 1 URL has a snapshot
      expect(mockRunDualDiff).not.toHaveBeenCalled();
    });

    it('gracefully handles S3 download failure without crashing', async () => {
      setupConsistencyMocks({
        enabledComponents: [{ id: 'comp-1', name: 'Button', selector: '.btn', enabled: 1 }],
        componentSnapshots: [
          { id: 'snap-1', url: 'https://a.com', s3Key: 'captures/run1/snap1/captured.png', viewport: '1280x720', capturedAt: new Date() },
          { id: 'snap-2', url: 'https://b.com', s3Key: 'captures/run1/snap2/captured.png', viewport: '1280x720', capturedAt: new Date() },
        ],
        projectUrls: [
          { url: 'https://a.com' },
          { url: 'https://b.com' },
        ],
      });

      // S3 download fails
      mockDownloadBuffer.mockRejectedValue(new Error('S3 connection failed'));

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      // Should not throw
      const result = await caller.components.consistency({ projectId: PROJECT_ID });

      expect(result).toHaveLength(1);
      const pages = result[0].pages;
      // On failure, fallback to 'consistent'
      expect(pages.every((p: any) => p.status === 'consistent')).toBe(true);
    });
  });
});
