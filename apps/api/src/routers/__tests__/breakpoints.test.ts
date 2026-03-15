import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sentinel/db before importing router
vi.mock('@sentinel/db', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  };
  return {
    createDb: vi.fn(() => mockDb),
    projects: { id: 'projects.id', workspaceId: 'projects.workspaceId' },
    breakpointPresets: {
      id: 'breakpointPresets.id',
      projectId: 'breakpointPresets.projectId',
      name: 'breakpointPresets.name',
      width: 'breakpointPresets.width',
      height: 'breakpointPresets.height',
      sortOrder: 'breakpointPresets.sortOrder',
      pixelDiffThreshold: 'breakpointPresets.pixelDiffThreshold',
      ssimThreshold: 'breakpointPresets.ssimThreshold',
      createdAt: 'breakpointPresets.createdAt',
    },
  };
});

vi.mock('@sentinel/capture', () => ({
  BREAKPOINT_TEMPLATES: {
    tailwind: [
      { name: 'sm', width: 640, height: 480 },
      { name: 'md', width: 768, height: 1024 },
      { name: 'lg', width: 1024, height: 768 },
      { name: 'xl', width: 1280, height: 800 },
      { name: '2xl', width: 1536, height: 864 },
    ],
    bootstrap: [
      { name: 'sm', width: 576, height: 480 },
      { name: 'md', width: 768, height: 1024 },
      { name: 'lg', width: 992, height: 768 },
      { name: 'xl', width: 1200, height: 800 },
      { name: 'xxl', width: 1400, height: 900 },
    ],
  },
}));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  asc: vi.fn((col) => ({ _type: 'asc', col })),
}));

describe('breakpoints router', () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createDb } = await import('@sentinel/db');
    mockDb = (createDb as ReturnType<typeof vi.fn>)();
  });

  function setupProjectOwnership(result: any[] = [{ id: 'proj-1' }]) {
    const mockWhere = vi.fn().mockResolvedValue(result);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.select.mockReturnValue({ from: mockFrom });
    return mockWhere;
  }

  const PROJECT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  describe('list', () => {
    it('returns empty array for project with no presets', async () => {
      // First select: project ownership check
      const mockOwnershipWhere = vi.fn().mockResolvedValue([{ id: 'proj-1' }]);
      const mockOwnershipFrom = vi.fn().mockReturnValue({ where: mockOwnershipWhere });

      // Second select: breakpoint list with orderBy
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockListWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockListFrom = vi.fn().mockReturnValue({ where: mockListWhere });

      mockDb.select
        .mockReturnValueOnce({ from: mockOwnershipFrom })
        .mockReturnValueOnce({ from: mockListFrom });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.breakpoints.list({ projectId: PROJECT_ID });

      expect(result).toEqual([]);
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });
  });

  describe('create', () => {
    it('inserts a breakpoint preset with name, width, height, sortOrder', async () => {
      const newPreset = {
        id: 'bp-1',
        projectId: PROJECT_ID,
        name: 'md',
        width: 768,
        height: 1024,
        sortOrder: 1,
        pixelDiffThreshold: null,
        ssimThreshold: null,
        createdAt: new Date(),
      };

      // Mock project ownership check
      const mockOwnershipWhere = vi.fn().mockResolvedValue([{ id: 'proj-1' }]);
      const mockOwnershipFrom = vi.fn().mockReturnValue({ where: mockOwnershipWhere });
      mockDb.select.mockReturnValue({ from: mockOwnershipFrom });

      // Mock insert().values().returning()
      const mockReturning = vi.fn().mockResolvedValue([newPreset]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.breakpoints.create({
        projectId: PROJECT_ID,
        name: 'md',
        width: 768,
        height: 1024,
        sortOrder: 1,
      });

      expect(result).toEqual(newPreset);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate name within same project (unique constraint)', async () => {
      // Mock project ownership check
      const mockOwnershipWhere = vi.fn().mockResolvedValue([{ id: 'proj-1' }]);
      const mockOwnershipFrom = vi.fn().mockReturnValue({ where: mockOwnershipWhere });
      mockDb.select.mockReturnValue({ from: mockOwnershipFrom });

      // Mock insert throws unique constraint error
      const mockReturning = vi.fn().mockRejectedValue(
        Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: '23505',
        }),
      );
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      await expect(
        caller.breakpoints.create({
          projectId: PROJECT_ID,
          name: 'md',
          width: 768,
          height: 1024,
        }),
      ).rejects.toThrow();
    });

    it('stores optional pixelDiffThreshold and ssimThreshold values', async () => {
      const newPreset = {
        id: 'bp-1',
        projectId: PROJECT_ID,
        name: 'lg',
        width: 1024,
        height: 768,
        sortOrder: 0,
        pixelDiffThreshold: 500,
        ssimThreshold: 9500,
        createdAt: new Date(),
      };

      const mockOwnershipWhere = vi.fn().mockResolvedValue([{ id: 'proj-1' }]);
      const mockOwnershipFrom = vi.fn().mockReturnValue({ where: mockOwnershipWhere });
      mockDb.select.mockReturnValue({ from: mockOwnershipFrom });

      const mockReturning = vi.fn().mockResolvedValue([newPreset]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.breakpoints.create({
        projectId: PROJECT_ID,
        name: 'lg',
        width: 1024,
        height: 768,
        pixelDiffThreshold: 500,
        ssimThreshold: 9500,
      });

      expect(result.pixelDiffThreshold).toBe(500);
      expect(result.ssimThreshold).toBe(9500);
    });
  });

  describe('update', () => {
    it('modifies preset fields', async () => {
      const updatedPreset = {
        id: 'bp-1',
        name: 'large',
        width: 1280,
        height: 800,
        sortOrder: 2,
      };

      // Mock preset ownership check (select with innerJoin)
      const mockOwnershipWhere = vi.fn().mockResolvedValue([{ id: 'bp-1', projectId: 'proj-1' }]);
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockOwnershipWhere });
      const mockOwnershipFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      mockDb.select.mockReturnValue({ from: mockOwnershipFrom });

      // Mock update().set().where().returning()
      const mockReturning = vi.fn().mockResolvedValue([updatedPreset]);
      const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      mockDb.update.mockReturnValue({ set: mockSet });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.breakpoints.update({
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        name: 'large',
        width: 1280,
        height: 800,
        sortOrder: 2,
      });

      expect(result).toEqual(updatedPreset);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete', () => {
    it('removes preset by id', async () => {
      // Mock preset ownership check
      const mockOwnershipWhere = vi.fn().mockResolvedValue([{ id: 'bp-1', projectId: 'proj-1' }]);
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockOwnershipWhere });
      const mockOwnershipFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      mockDb.select.mockReturnValue({ from: mockOwnershipFrom });

      // Mock delete().where()
      const mockDeleteWhere = vi.fn().mockResolvedValue([]);
      mockDb.delete.mockReturnValue({ where: mockDeleteWhere });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.breakpoints.delete({
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });

      expect(result).toEqual({ success: true });
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('applyTemplate', () => {
    it('inserts 5 Tailwind presets (sm 640, md 768, lg 1024, xl 1280, 2xl 1536)', async () => {
      // Mock project ownership check
      const mockOwnershipWhere = vi.fn().mockResolvedValue([{ id: 'proj-1' }]);
      const mockOwnershipFrom = vi.fn().mockReturnValue({ where: mockOwnershipWhere });
      mockDb.select.mockReturnValue({ from: mockOwnershipFrom });

      const insertedPresets = [
        { id: 'bp-1', name: 'sm', width: 640, height: 480, sortOrder: 0 },
        { id: 'bp-2', name: 'md', width: 768, height: 1024, sortOrder: 1 },
        { id: 'bp-3', name: 'lg', width: 1024, height: 768, sortOrder: 2 },
        { id: 'bp-4', name: 'xl', width: 1280, height: 800, sortOrder: 3 },
        { id: 'bp-5', name: '2xl', width: 1536, height: 864, sortOrder: 4 },
      ];

      // Mock transaction: receives a callback, calls it with a tx object
      mockDb.transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const txMockDeleteWhere = vi.fn().mockResolvedValue([]);
        const txMockDelete = vi.fn().mockReturnValue({ where: txMockDeleteWhere });

        const txMockReturning = vi.fn().mockResolvedValue(insertedPresets);
        const txMockValues = vi.fn().mockReturnValue({ returning: txMockReturning });
        const txMockInsert = vi.fn().mockReturnValue({ values: txMockValues });

        const tx = {
          delete: txMockDelete,
          insert: txMockInsert,
        };
        return cb(tx);
      });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.breakpoints.applyTemplate({
        projectId: PROJECT_ID,
        template: 'tailwind',
      });

      expect(result).toHaveLength(5);
      expect(result[0].name).toBe('sm');
      expect(result[0].width).toBe(640);
      expect(result[4].name).toBe('2xl');
      expect(result[4].width).toBe(1536);
    });

    it('inserts 5 Bootstrap presets (sm 576, md 768, lg 992, xl 1200, xxl 1400)', async () => {
      const mockOwnershipWhere = vi.fn().mockResolvedValue([{ id: 'proj-1' }]);
      const mockOwnershipFrom = vi.fn().mockReturnValue({ where: mockOwnershipWhere });
      mockDb.select.mockReturnValue({ from: mockOwnershipFrom });

      const insertedPresets = [
        { id: 'bp-1', name: 'sm', width: 576, height: 480, sortOrder: 0 },
        { id: 'bp-2', name: 'md', width: 768, height: 1024, sortOrder: 1 },
        { id: 'bp-3', name: 'lg', width: 992, height: 768, sortOrder: 2 },
        { id: 'bp-4', name: 'xl', width: 1200, height: 800, sortOrder: 3 },
        { id: 'bp-5', name: 'xxl', width: 1400, height: 900, sortOrder: 4 },
      ];

      mockDb.transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const txMockDeleteWhere = vi.fn().mockResolvedValue([]);
        const txMockDelete = vi.fn().mockReturnValue({ where: txMockDeleteWhere });

        const txMockReturning = vi.fn().mockResolvedValue(insertedPresets);
        const txMockValues = vi.fn().mockReturnValue({ returning: txMockReturning });
        const txMockInsert = vi.fn().mockReturnValue({ values: txMockValues });

        const tx = {
          delete: txMockDelete,
          insert: txMockInsert,
        };
        return cb(tx);
      });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.breakpoints.applyTemplate({
        projectId: PROJECT_ID,
        template: 'bootstrap',
      });

      expect(result).toHaveLength(5);
      expect(result[0].name).toBe('sm');
      expect(result[0].width).toBe(576);
      expect(result[4].name).toBe('xxl');
      expect(result[4].width).toBe(1400);
    });

    it('replaces existing presets (delete + insert in transaction)', async () => {
      const mockOwnershipWhere = vi.fn().mockResolvedValue([{ id: 'proj-1' }]);
      const mockOwnershipFrom = vi.fn().mockReturnValue({ where: mockOwnershipWhere });
      mockDb.select.mockReturnValue({ from: mockOwnershipFrom });

      let deleteWasCalled = false;
      let insertWasCalled = false;
      const insertedPresets = [
        { id: 'bp-1', name: 'sm', width: 640, height: 480, sortOrder: 0 },
      ];

      mockDb.transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const txMockDeleteWhere = vi.fn().mockImplementation(() => {
          deleteWasCalled = true;
          return Promise.resolve([]);
        });
        const txMockDelete = vi.fn().mockReturnValue({ where: txMockDeleteWhere });

        const txMockReturning = vi.fn().mockImplementation(() => {
          insertWasCalled = true;
          return Promise.resolve(insertedPresets);
        });
        const txMockValues = vi.fn().mockReturnValue({ returning: txMockReturning });
        const txMockInsert = vi.fn().mockReturnValue({ values: txMockValues });

        const tx = {
          delete: txMockDelete,
          insert: txMockInsert,
        };
        return cb(tx);
      });

      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      await caller.breakpoints.applyTemplate({
        projectId: PROJECT_ID,
        template: 'tailwind',
      });

      expect(deleteWasCalled).toBe(true);
      expect(insertWasCalled).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('templates', () => {
    it('returns BREAKPOINT_TEMPLATES object with tailwind and bootstrap keys', async () => {
      const { appRouter } = await import('../../routers/index.js');
      const caller = appRouter.createCaller({ auth: null } as any);

      const result = await caller.breakpoints.templates();

      expect(result).toHaveProperty('tailwind');
      expect(result).toHaveProperty('bootstrap');
      expect(result.tailwind).toHaveLength(5);
      expect(result.bootstrap).toHaveLength(5);
    });
  });
});
