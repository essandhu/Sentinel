import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Test UUIDs ----------
const WORKSPACE_ID = '00000000-0000-4000-a000-000000000700';
const PROJECT_ID = '00000000-0000-4000-a000-000000000701';

// ---------- Hoisted mocks (available inside vi.mock factories) ----------
const { mockListProjects, sharedMockDb } = vi.hoisted(() => {
  const mockListProjects = vi.fn();
  const sharedMockDb: Record<string, any> = {
    insert: vi.fn(),
  };
  return { mockListProjects, sharedMockDb };
});

vi.mock('../services/project-service.js', () => ({
  listProjects: (...args: unknown[]) => mockListProjects(...args),
}));

vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => sharedMockDb),
  projects: {
    id: 'projects.id',
    name: 'projects.name',
    workspaceId: 'projects.workspaceId',
    createdAt: 'projects.createdAt',
    repositoryUrl: 'projects.repositoryUrl',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
}));

// Import router AFTER mocks
import { projectsRouter } from './projects.js';
import { t } from '../trpc.js';

const createCaller = t.createCallerFactory(projectsRouter);

// Helper to set up insert chain mock
function setupInsertMock(insertResult: unknown[]) {
  const chain: Record<string, any> = {};
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  chain.then = (fn: (v: unknown) => unknown) =>
    Promise.resolve(insertResult).then(fn);
  sharedMockDb.insert = vi.fn(() => chain);
}

describe('projectsRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedMockDb.insert = vi.fn();
  });

  describe('list', () => {
    it('returns projects from listProjects service', async () => {
      const projectsList = [
        { id: PROJECT_ID, name: 'My Project', createdAt: new Date() },
      ];
      mockListProjects.mockResolvedValue(projectsList);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.list();

      expect(result).toEqual(projectsList);
      expect(mockListProjects).toHaveBeenCalledTimes(1);
    });

    it('passes workspaceId from context to listProjects', async () => {
      mockListProjects.mockResolvedValue([]);

      const caller = createCaller({
        auth: { userId: 'user-1', orgId: WORKSPACE_ID, orgRole: 'org:member' },
      } as any);
      await caller.list();

      expect(mockListProjects).toHaveBeenCalledWith(
        expect.anything(), // db
        WORKSPACE_ID,
      );
    });
  });

  describe('create', () => {
    it('inserts project with correct name and workspaceId', async () => {
      const inserted = {
        id: PROJECT_ID,
        name: 'New Project',
        workspaceId: WORKSPACE_ID,
        createdAt: new Date(),
      };
      setupInsertMock([inserted]);

      const caller = createCaller({
        auth: { userId: 'user-1', orgId: WORKSPACE_ID, orgRole: 'org:member' },
      } as any);
      await caller.create({ name: 'New Project' });

      expect(sharedMockDb.insert).toHaveBeenCalled();
      // Verify the values passed to .values()
      const insertChain = sharedMockDb.insert.mock.results[0].value;
      expect(insertChain.values).toHaveBeenCalledWith({
        name: 'New Project',
        workspaceId: WORKSPACE_ID,
      });
    });

    it('returns the inserted row', async () => {
      const inserted = {
        id: PROJECT_ID,
        name: 'New Project',
        workspaceId: WORKSPACE_ID,
        createdAt: new Date(),
      };
      setupInsertMock([inserted]);

      const caller = createCaller({
        auth: { userId: 'user-1', orgId: WORKSPACE_ID, orgRole: 'org:member' },
      } as any);
      const result = await caller.create({ name: 'New Project' });

      expect(result).toEqual(inserted);
    });
  });
});
