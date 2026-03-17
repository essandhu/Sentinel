import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------- Hoisted mocks ----------
const mockSelect = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockWhere = vi.hoisted(() => vi.fn());
const mockInnerJoin = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockSet = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn());

vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
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
    name: 'projects.name',
    createdAt: 'projects.created_at',
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.project_id',
    commitSha: 'captureRuns.commit_sha',
    branchName: 'captureRuns.branch_name',
    status: 'captureRuns.status',
    source: 'captureRuns.source',
    createdAt: 'captureRuns.created_at',
    completedAt: 'captureRuns.completed_at',
  },
  snapshots: {
    id: 'snapshots.id',
    runId: 'snapshots.run_id',
    url: 'snapshots.url',
    viewport: 'snapshots.viewport',
    s3Key: 'snapshots.s3_key',
    componentId: 'snapshots.component_id',
    capturedAt: 'snapshots.captured_at',
  },
  diffReports: {
    id: 'diffReports.id',
    snapshotId: 'diffReports.snapshot_id',
    pixelDiffPercent: 'diffReports.pixel_diff_percent',
    ssimScore: 'diffReports.ssim_score',
    passed: 'diffReports.passed',
    createdAt: 'diffReports.created_at',
    baselineS3Key: 'diffReports.baseline_s3_key',
    diffS3Key: 'diffReports.diff_s3_key',
  },
  components: {
    id: 'components.id',
    projectId: 'components.project_id',
    name: 'components.name',
    selector: 'components.selector',
    description: 'components.description',
    enabled: 'components.enabled',
    createdAt: 'components.created_at',
    updatedAt: 'components.updated_at',
  },
  healthScores: {
    id: 'healthScores.id',
    projectId: 'healthScores.project_id',
    componentId: 'healthScores.component_id',
    score: 'healthScores.score',
    windowDays: 'healthScores.window_days',
    computedAt: 'healthScores.computed_at',
  },
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

// Mock ioredis for rate limiter
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

// Set required env vars
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// ---------- Test data ----------
const VALID_KEY = 'sk_live_testkey123';
const AUTH_HEADERS = { 'x-api-key': VALID_KEY };
const WORKSPACE_ID = 'ws-test-001';
const PROJECT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const RUN_ID = 'b1ffcd00-1234-5678-abcd-123456789abc';

describe('REST API v1 resource endpoints', () => {
  let app: FastifyInstance;

  /**
   * Helper: configure mock DB to authenticate the API key.
   * The auth hook calls select().from().where() on apiKeys.
   */
  function mockAuthSuccess() {
    // Auth hook: select -> from -> where returns valid key
    const authWhere = vi.fn().mockResolvedValue([
      { id: 'key-uuid-1', workspaceId: WORKSPACE_ID },
    ]);
    const authFrom = vi.fn().mockReturnValue({ where: authWhere });

    // Update chain for lastUsedAt fire-and-forget
    const updateCatch = { catch: vi.fn() };
    const updateWhereResult = Object.assign(Promise.resolve(), updateCatch);
    mockUpdateWhere.mockReturnValue(updateWhereResult);
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    return { authFrom, authWhere };
  }

  /**
   * Helper: set up the mock DB select chain.
   * Calls are sequential: auth first, then route handler queries.
   */
  function setupSelectChain(calls: Array<{ result: any[]; hasInnerJoin?: boolean }>) {
    const authMock = mockAuthSuccess();
    const selectReturnValues: any[] = [{ from: authMock.authFrom }];

    for (const call of calls) {
      if (call.hasInnerJoin) {
        const where = vi.fn().mockResolvedValue(call.result);
        // Support chained innerJoin calls (e.g. from -> innerJoin -> innerJoin -> innerJoin -> where)
        const innerJoinProxy: any = vi.fn().mockImplementation(() => ({ innerJoin: innerJoinProxy, where }));
        const from = vi.fn().mockReturnValue({ innerJoin: innerJoinProxy, where });
        selectReturnValues.push({ from });
      } else {
        const where = vi.fn().mockResolvedValue(call.result);
        const from = vi.fn().mockReturnValue({ where });
        selectReturnValues.push({ from });
      }
    }

    let callIndex = 0;
    mockSelect.mockImplementation(() => {
      const val = selectReturnValues[callIndex] || selectReturnValues[selectReturnValues.length - 1];
      callIndex++;
      return val;
    });
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default: auth fails (no matching key)
    const defaultWhere = vi.fn().mockResolvedValue([]);
    const defaultFrom = vi.fn().mockReturnValue({ where: defaultWhere });
    mockSelect.mockReturnValue({ from: defaultFrom });

    // Default update chain
    const updateCatch = { catch: vi.fn() };
    const updateWhereResult = Object.assign(Promise.resolve(), updateCatch);
    mockUpdateWhere.mockReturnValue(updateWhereResult);
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
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

  // ---- Auth rejection ----
  it('returns 401 without API key for all endpoints', async () => {
    const server = await createTestApp();

    const endpoints = [
      '/api/v1/projects',
      `/api/v1/projects/${PROJECT_ID}`,
      `/api/v1/projects/${PROJECT_ID}/captures`,
      `/api/v1/captures/${RUN_ID}/diffs`,
      `/api/v1/projects/${PROJECT_ID}/components`,
      `/api/v1/projects/${PROJECT_ID}/health-scores`,
    ];

    for (const url of endpoints) {
      const res = await server.inject({ method: 'GET', url });
      expect(res.statusCode, `${url} should return 401`).toBe(401);
    }
  });

  // ---- Projects ----
  describe('GET /api/v1/projects', () => {
    it('returns array of projects for authenticated workspace', async () => {
      const projectsList = [
        { id: PROJECT_ID, name: 'My Project', createdAt: new Date('2026-01-01') },
      ];

      setupSelectChain([{ result: projectsList }]);

      const server = await createTestApp();
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(PROJECT_ID);
      expect(body[0].name).toBe('My Project');
    });

    it('returns empty array when no projects exist', async () => {
      setupSelectChain([{ result: [] }]);

      const server = await createTestApp();
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('returns single project', async () => {
      const project = { id: PROJECT_ID, name: 'Test Project', createdAt: new Date('2026-01-01') };
      setupSelectChain([{ result: [project] }]);

      const server = await createTestApp();
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${PROJECT_ID}`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(PROJECT_ID);
    });

    it('returns 404 for non-existent project', async () => {
      setupSelectChain([{ result: [] }]);

      const server = await createTestApp();
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${PROJECT_ID}`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('Project not found');
    });
  });

  // ---- Captures ----
  describe('GET /api/v1/projects/:projectId/captures', () => {
    it('returns captures for project', async () => {
      const captures = [
        { id: RUN_ID, commitSha: 'abc123', branchName: 'main', status: 'completed', source: 'ci', createdAt: new Date(), completedAt: new Date() },
      ];

      // First call: verify project ownership; Second call: query captures
      setupSelectChain([
        { result: [{ id: PROJECT_ID }] },
        { result: captures },
      ]);

      const server = await createTestApp();
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${PROJECT_ID}/captures`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(RUN_ID);
    });

    it('returns 404 if project not found in workspace', async () => {
      setupSelectChain([{ result: [] }]);

      const server = await createTestApp();
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${PROJECT_ID}/captures`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ---- Diffs ----
  describe('GET /api/v1/captures/:runId/diffs', () => {
    it('returns diffs for capture run', async () => {
      const diffs = [
        {
          id: 'diff-1',
          snapshotId: 'snap-1',
          snapshotS3Key: 'snapshots/snap-1.png',
          url: 'https://example.com',
          viewport: '1280x720',
          browser: 'chromium',
          baselineS3Key: null,
          diffS3Key: null,
          pixelDiffPercent: 250,
          ssimScore: 9800,
          passed: 'true',
          createdAt: new Date(),
        },
      ];

      // Auth (1st select), then verify run ownership via join (2nd select), then query diffs (3rd select)
      setupSelectChain([
        { result: [{ id: RUN_ID, projectId: PROJECT_ID }], hasInnerJoin: true },
        { result: diffs, hasInnerJoin: true },
      ]);

      const server = await createTestApp();
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/captures/${RUN_ID}/diffs`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0].browser).toBe('chromium');
      expect(typeof body[0].browser).toBe('string');
    });

    it('returns 404 if run not found in workspace', async () => {
      setupSelectChain([{ result: [], hasInnerJoin: true }]);

      const server = await createTestApp();
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/captures/${RUN_ID}/diffs`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ---- Components ----
  describe('GET /api/v1/projects/:projectId/components', () => {
    it('returns components for project', async () => {
      const componentsList = [
        { id: 'comp-1', name: 'Button', selector: '.btn', description: null, enabled: 1, createdAt: new Date() },
      ];

      setupSelectChain([
        { result: [{ id: PROJECT_ID }] },
        { result: componentsList },
      ]);

      const server = await createTestApp();
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${PROJECT_ID}/components`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('Button');
    });
  });

  // ---- Health Scores ----
  describe('GET /api/v1/projects/:projectId/health-scores', () => {
    it('returns health scores for project', async () => {
      const scores = [
        { id: 'hs-1', componentId: 'comp-1', score: 85, windowDays: 30, computedAt: new Date() },
      ];

      setupSelectChain([
        { result: [{ id: PROJECT_ID }] },
        { result: scores },
      ]);

      const server = await createTestApp();
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${PROJECT_ID}/health-scores`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0].score).toBe(85);
    });
  });

  // ---- Bearer auth ----
  it('accepts Authorization: Bearer header', async () => {
    const projectsList = [{ id: PROJECT_ID, name: 'Test', createdAt: new Date() }];
    setupSelectChain([{ result: projectsList }]);

    const server = await createTestApp();
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${VALID_KEY}` },
    });

    expect(res.statusCode).toBe(200);
  });

  // ---- OpenAPI spec ----
  it('GET /api/v1/docs/json includes all endpoint paths', async () => {
    const server = await createTestApp();
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/docs/json',
    });

    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toBeDefined();

    const paths = Object.keys(spec.paths || {});
    // Paths may or may not include the /api/v1 prefix depending on swagger config
    const hasPath = (suffix: string) =>
      paths.some((p) => p === suffix || p === `/api/v1${suffix}`);

    expect(hasPath('/projects')).toBe(true);
    expect(hasPath('/projects/{id}')).toBe(true);
    expect(hasPath('/projects/{projectId}/captures')).toBe(true);
    expect(hasPath('/captures/{runId}/diffs')).toBe(true);
    expect(hasPath('/projects/{projectId}/components')).toBe(true);
    expect(hasPath('/projects/{projectId}/health-scores')).toBe(true);
  });

  // ---- Cross-workspace isolation ----
  it('returns 404 for project belonging to different workspace', async () => {
    // Auth succeeds for ws-test-001, but project query returns empty (project in different workspace)
    setupSelectChain([{ result: [] }]);

    const server = await createTestApp();
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${PROJECT_ID}`,
      headers: AUTH_HEADERS,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('Project not found');
  });
});
