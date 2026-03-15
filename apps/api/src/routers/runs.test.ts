import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Test UUIDs ----------
const WORKSPACE_ID = '00000000-0000-4000-a000-000000000900';
const PROJECT_ID = '00000000-0000-4000-a000-000000000901';
const RUN_ID = '00000000-0000-4000-a000-000000000902';

// ---------- Mock service functions ----------
const mockListRuns = vi.fn();
const mockGetRunById = vi.fn();

vi.mock('../services/run-service.js', () => ({
  listRuns: (...args: unknown[]) => mockListRuns(...args),
  getRunById: (...args: unknown[]) => mockGetRunById(...args),
}));

// Mock @sentinel/db
vi.mock('@sentinel/db', () => ({
  createDb: vi.fn(() => ({})),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  count: vi.fn(() => 'count(*)'),
}));

// Import router AFTER mocks
import { runsRouter } from './runs.js';
import { t } from '../trpc.js';

const createCaller = t.createCallerFactory(runsRouter);

describe('runsRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('calls listRuns with projectId and workspaceId', async () => {
      const runs = [
        { id: RUN_ID, projectId: PROJECT_ID, status: 'completed', createdAt: new Date() },
      ];
      mockListRuns.mockResolvedValue(runs);

      const caller = createCaller({
        auth: { userId: 'user-1', orgId: WORKSPACE_ID, orgRole: 'org:member' },
      } as any);
      const result = await caller.list({ projectId: PROJECT_ID });

      expect(result).toEqual(runs);
      expect(mockListRuns).toHaveBeenCalledWith(
        expect.anything(), // db
        { projectId: PROJECT_ID, workspaceId: WORKSPACE_ID },
      );
    });

    it('passes undefined projectId when input is omitted', async () => {
      mockListRuns.mockResolvedValue([]);

      const caller = createCaller({
        auth: { userId: 'user-1', orgId: WORKSPACE_ID, orgRole: 'org:member' },
      } as any);
      await caller.list();

      expect(mockListRuns).toHaveBeenCalledWith(
        expect.anything(), // db
        { projectId: undefined, workspaceId: WORKSPACE_ID },
      );
    });
  });

  describe('get', () => {
    it('calls getRunById with runId and workspaceId', async () => {
      const run = {
        id: RUN_ID,
        projectId: PROJECT_ID,
        status: 'completed',
        createdAt: new Date(),
      };
      mockGetRunById.mockResolvedValue(run);

      const caller = createCaller({
        auth: { userId: 'user-1', orgId: WORKSPACE_ID, orgRole: 'org:member' },
      } as any);
      const result = await caller.get({ runId: RUN_ID });

      expect(result).toEqual(run);
      expect(mockGetRunById).toHaveBeenCalledWith(
        expect.anything(), // db
        RUN_ID,
        WORKSPACE_ID,
      );
    });

    it('returns null when run not found', async () => {
      mockGetRunById.mockResolvedValue(null);

      const caller = createCaller({
        auth: { userId: 'user-1', orgId: WORKSPACE_ID, orgRole: 'org:member' },
      } as any);
      const result = await caller.get({ runId: RUN_ID });

      expect(result).toBeNull();
    });
  });
});
