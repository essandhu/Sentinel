import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------- Hoisted mocks ----------
const mockSelect = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockWhere = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockSet = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockInsertValues = vi.hoisted(() => vi.fn());
const mockQueueAdd = vi.hoisted(() => vi.fn());

vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  })),
  apiKeys: {
    id: 'api_keys.id',
    workspaceId: 'api_keys.workspace_id',
    keyHash: 'api_keys.key_hash',
    revokedAt: 'api_keys.revoked_at',
    lastUsedAt: 'api_keys.last_used_at',
  },
  projects: {
    id: 'projects.id',
    workspaceId: 'projects.workspace_id',
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.project_id',
  },
  diffReports: { id: 'diffReports.id', snapshotId: 'diffReports.snapshot_id' },
  snapshots: { id: 'snapshots.id', runId: 'snapshots.run_id', url: 'snapshots.url', viewport: 'snapshots.viewport', s3Key: 'snapshots.s3_key' },
  baselines: {},
  approvalDecisions: { id: 'approvalDecisions.id' },
}));

vi.mock('../../../services/api-key-service.js', () => ({
  hashApiKey: vi.fn((key: string) => `hashed_${key}`),
}));

vi.mock('@clerk/fastify', () => ({
  clerkPlugin: vi.fn(),
  getAuth: vi.fn(() => ({ userId: 'user_test123' })),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  isNull: vi.fn((col) => ({ _type: 'isNull', col })),
}));

vi.mock('ioredis', () => {
  const RedisMock = vi.fn().mockImplementation(function (this: any) {
    this.status = 'ready';
    this.get = vi.fn().mockResolvedValue(null);
    this.set = vi.fn().mockResolvedValue('OK');
    this.incr = vi.fn().mockResolvedValue(1);
    this.pttl = vi.fn().mockResolvedValue(-1);
    this.ttl = vi.fn().mockResolvedValue(-1);
    this.pexpire = vi.fn().mockResolvedValue(1);
    this.eval = vi.fn().mockResolvedValue([1, 60000]);
    this.defineCommand = vi.fn();
    this.rateLimiter = vi.fn().mockResolvedValue([0, 60000]);
    this.quit = vi.fn().mockResolvedValue('OK');
    this.disconnect = vi.fn();
    this.on = vi.fn().mockReturnThis();
    this.once = vi.fn().mockReturnThis();
    return this;
  });
  return { Redis: RedisMock, default: RedisMock };
});

// Mock BullMQ queue
vi.mock('../../../queue.js', () => ({
  getCaptureQueue: vi.fn(() => ({
    add: mockQueueAdd,
  })),
}));

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

const VALID_KEY = 'sk_live_testkey123';
const AUTH_HEADERS = { 'x-api-key': VALID_KEY };
const WORKSPACE_ID = 'ws-test-001';
const PROJECT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('REST API v1 capture trigger endpoint', () => {
  let app: FastifyInstance;

  function mockAuthSuccess() {
    const authWhere = vi.fn().mockResolvedValue([
      { id: 'key-uuid-1', workspaceId: WORKSPACE_ID },
    ]);
    const authFrom = vi.fn().mockReturnValue({ where: authWhere });

    const updateCatch = { catch: vi.fn() };
    const updateWhereResult = Object.assign(Promise.resolve(), updateCatch);
    mockUpdateWhere.mockReturnValue(updateWhereResult);
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    return { authFrom, authWhere };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: auth fails
    const defaultWhere = vi.fn().mockResolvedValue([]);
    const defaultFrom = vi.fn().mockReturnValue({ where: defaultWhere });
    mockSelect.mockReturnValue({ from: defaultFrom });

    // Default update chain
    const updateCatch = { catch: vi.fn() };
    const updateWhereResult = Object.assign(Promise.resolve(), updateCatch);
    mockUpdateWhere.mockReturnValue(updateWhereResult);
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    // Default insert chain
    mockInsertValues.mockResolvedValue([]);
    mockInsert.mockReturnValue({ values: mockInsertValues });

    // Default queue mock
    mockQueueAdd.mockResolvedValue({ id: 'job-123' });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  async function createTestApp() {
    const { buildServer } = await import('../../../server.js');
    app = await buildServer();
    await app.ready();
    return app;
  }

  describe('POST /api/v1/captures/run', () => {
    it('returns 200 {runId, jobId} with valid input', async () => {
      const authMock = mockAuthSuccess();

      // Auth, then project check
      const projectWhere = vi.fn().mockResolvedValue([{ id: PROJECT_ID }]);
      const projectFrom = vi.fn().mockReturnValue({ where: projectWhere });

      let callIndex = 0;
      mockSelect.mockImplementation(() => {
        const returns = [
          { from: authMock.authFrom },
          { from: projectFrom },
        ];
        return returns[callIndex++] || returns[returns.length - 1];
      });

      const server = await createTestApp();
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/captures/run',
        headers: AUTH_HEADERS,
        payload: { projectId: PROJECT_ID, configPath: './sentinel.config.yml' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.runId).toBeDefined();
      expect(body.jobId).toBe('job-123');
      // Should have inserted captureRun
      expect(mockInsert).toHaveBeenCalledTimes(1);
      // Should have enqueued BullMQ job
      expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when project not in workspace', async () => {
      const authMock = mockAuthSuccess();

      const projectWhere = vi.fn().mockResolvedValue([]);
      const projectFrom = vi.fn().mockReturnValue({ where: projectWhere });

      let callIndex = 0;
      mockSelect.mockImplementation(() => {
        const returns = [
          { from: authMock.authFrom },
          { from: projectFrom },
        ];
        return returns[callIndex++] || returns[returns.length - 1];
      });

      const server = await createTestApp();
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/captures/run',
        headers: AUTH_HEADERS,
        payload: { projectId: PROJECT_ID, configPath: './sentinel.config.yml' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('Project not found');
    });

    it('returns 401 without API key', async () => {
      const server = await createTestApp();
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/captures/run',
        payload: { projectId: PROJECT_ID, configPath: './sentinel.config.yml' },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
