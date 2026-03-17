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
const mockInsert = vi.hoisted(() => vi.fn());
const mockInsertValues = vi.hoisted(() => vi.fn());

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
  diffReports: {
    id: 'diffReports.id',
    snapshotId: 'diffReports.snapshot_id',
  },
  snapshots: {
    id: 'snapshots.id',
    runId: 'snapshots.run_id',
    url: 'snapshots.url',
    viewport: 'snapshots.viewport',
    browser: 'snapshots.browser',
    s3Key: 'snapshots.s3_key',
    parameterName: 'snapshots.parameter_name',
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.project_id',
  },
  baselines: {},
  approvalDecisions: {
    id: 'approvalDecisions.id',
  },
  approvalChainSteps: {
    id: 'approvalChainSteps.id',
    projectId: 'approvalChainSteps.projectId',
    stepOrder: 'approvalChainSteps.stepOrder',
    label: 'approvalChainSteps.label',
    requiredRole: 'approvalChainSteps.requiredRole',
    requiredUserId: 'approvalChainSteps.requiredUserId',
    createdAt: 'approvalChainSteps.createdAt',
  },
  approvalChainProgress: {
    id: 'approvalChainProgress.id',
    diffReportId: 'approvalChainProgress.diffReportId',
    stepId: 'approvalChainProgress.stepId',
    stepOrder: 'approvalChainProgress.stepOrder',
    userId: 'approvalChainProgress.userId',
    userEmail: 'approvalChainProgress.userEmail',
    completedAt: 'approvalChainProgress.completedAt',
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
  asc: vi.fn((col) => ({ _type: 'asc', col })),
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

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

const VALID_KEY = 'sk_live_testkey123';
const AUTH_HEADERS = { 'x-api-key': VALID_KEY };
const WORKSPACE_ID = 'ws-test-001';
const DIFF_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('REST API v1 approval endpoints', () => {
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

  // ---- Approve ----
  describe('POST /api/v1/diffs/:id/approve', () => {
    it('returns 200 {success: true} with valid auth and diff found', async () => {
      const authMock = mockAuthSuccess();

      // Setup select chain: auth -> verifyDiffOwnership (with innerJoin) -> getChainForProject (empty)
      const diffRow = {
        diffId: DIFF_ID,
        snapshotId: 'snap-1',
        url: 'https://example.com',
        viewport: '1280x720',
        browser: 'firefox',
        s3Key: 'snapshots/snap-1.png',
        projectId: 'proj-1',
      };
      const diffWhere = vi.fn().mockResolvedValue([diffRow]);
      const innerJoinProxy: any = vi.fn().mockImplementation(() => ({ innerJoin: innerJoinProxy, where: diffWhere }));
      const diffFrom = vi.fn().mockReturnValue({ innerJoin: innerJoinProxy, where: diffWhere });

      // Chain check: return empty (no chain = legacy path)
      const chainableEmpty = () => {
        const chain: Record<string, any> = {};
        chain.from = vi.fn(() => chain);
        chain.where = vi.fn(() => chain);
        chain.orderBy = vi.fn(() => chain);
        chain.limit = vi.fn(() => chain);
        chain.then = (fn: (v: unknown) => unknown) => Promise.resolve([]).then(fn);
        return chain;
      };

      let callIndex = 0;
      mockSelect.mockImplementation(() => {
        const returns = [
          { from: authMock.authFrom },
          { from: diffFrom },
          chainableEmpty(),
        ];
        return returns[callIndex++] || chainableEmpty();
      });

      const server = await createTestApp();
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/diffs/${DIFF_ID}/approve`,
        headers: AUTH_HEADERS,
        payload: { reason: 'looks good' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
      // Should have inserted baseline + approvalDecision
      expect(mockInsert).toHaveBeenCalledTimes(2);
      // Baseline insert must propagate browser from snapshot
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ browser: 'firefox' }));
    });

    it('returns 404 when diff not found in workspace', async () => {
      const authMock = mockAuthSuccess();

      const diffWhere = vi.fn().mockResolvedValue([]);
      const innerJoinProxy: any = vi.fn().mockImplementation(() => ({ innerJoin: innerJoinProxy, where: diffWhere }));
      const diffFrom = vi.fn().mockReturnValue({ innerJoin: innerJoinProxy, where: diffWhere });

      let callIndex = 0;
      mockSelect.mockImplementation(() => {
        const returns = [
          { from: authMock.authFrom },
          { from: diffFrom },
        ];
        return returns[callIndex++] || returns[returns.length - 1];
      });

      const server = await createTestApp();
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/diffs/${DIFF_ID}/approve`,
        headers: AUTH_HEADERS,
        payload: {},
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('Diff report not found');
    });

    it('returns 401 without API key', async () => {
      const server = await createTestApp();
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/diffs/${DIFF_ID}/approve`,
        payload: {},
      });

      expect(res.statusCode).toBe(401);
    });

    it('approve with chain propagates parameterName to maybePromoteBaseline', async () => {
      const authMock = mockAuthSuccess();

      const diffRow = {
        diffId: DIFF_ID,
        snapshotId: 'snap-1',
        url: 'https://example.com',
        viewport: '1280x720',
        browser: 'firefox',
        s3Key: 'snapshots/snap-1.png',
        projectId: 'proj-1',
        parameterName: 'theme:dark|locale:fr',
      };
      const diffWhere = vi.fn().mockResolvedValue([diffRow]);
      const innerJoinProxy: any = vi.fn().mockImplementation(() => ({ innerJoin: innerJoinProxy, where: diffWhere }));
      const diffFrom = vi.fn().mockReturnValue({ innerJoin: innerJoinProxy, where: diffWhere });

      // Chain check: return a chain step (triggers chain-aware path)
      const chainStep = { id: 'step-1', projectId: 'proj-1', stepOrder: 1, label: 'QA', requiredRole: null, requiredUserId: null };
      const chainableSteps = () => {
        const chain: Record<string, any> = {};
        chain.from = vi.fn(() => chain);
        chain.where = vi.fn(() => chain);
        chain.orderBy = vi.fn(() => chain);
        chain.limit = vi.fn(() => chain);
        chain.then = (fn: (v: unknown) => unknown) => Promise.resolve([chainStep]).then(fn);
        return chain;
      };
      // validateAndRecordApproval needs: getCurrentStep (chain steps + progress), then isChainComplete (chain steps + progress)
      // getCurrentStep: getChainForProject (steps), progress query (empty -> step is current)
      // After recordStepApproval, isChainComplete: getChainForProject (steps), progress query ([stepOrder:1])
      const chainableProgress = (data: unknown[]) => () => {
        const chain: Record<string, any> = {};
        chain.from = vi.fn(() => chain);
        chain.where = vi.fn(() => chain);
        chain.orderBy = vi.fn(() => chain);
        chain.limit = vi.fn(() => chain);
        chain.then = (fn: (v: unknown) => unknown) => Promise.resolve(data).then(fn);
        return chain;
      };

      let selectCallIndex = 0;
      mockSelect.mockImplementation(() => {
        const returns = [
          { from: authMock.authFrom },                   // 0: auth
          { from: diffFrom },                            // 1: verifyDiffOwnership
          chainableSteps(),                              // 2: getChainForProject (for chain check)
          chainableSteps(),                              // 3: getChainForProject (getCurrentStep)
          chainableProgress([])(),                       // 4: progress (no completions yet)
          chainableSteps(),                              // 5: getChainForProject (for canUserComplete - no, for getChainForProject in isChainComplete after record)
          chainableProgress([{ stepOrder: 1 }])(),       // 6: progress (now complete)
        ];
        return returns[selectCallIndex++] || chainableProgress([])();
      });

      // Insert chain: recordStepApproval + audit decision + maybePromoteBaseline baseline
      const insertValuesSpy = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
        onConflictDoNothing: vi.fn().mockResolvedValue([]),
        then: (fn: (v: unknown) => unknown) => Promise.resolve([]).then(fn),
      });
      mockInsert.mockReturnValue({ values: insertValuesSpy });

      const server = await createTestApp();
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/diffs/${DIFF_ID}/approve`,
        headers: AUTH_HEADERS,
        payload: { reason: 'looks good' },
      });

      expect(res.statusCode).toBe(200);
      // maybePromoteBaseline should have been called with parameterName from diffRow
      // The last insert call should be the baseline with correct parameterName
      const allValuesCalls = insertValuesSpy.mock.calls;
      const baselineCall = allValuesCalls.find(
        (call: unknown[]) => call[0] && (call[0] as any).parameterName === 'theme:dark|locale:fr',
      );
      expect(baselineCall).toBeDefined();
    });
  });

  // ---- Reject ----
  describe('POST /api/v1/diffs/:id/reject', () => {
    it('returns 200 {success: true} with valid auth and diff found', async () => {
      const authMock = mockAuthSuccess();

      const diffRow = {
        diffId: DIFF_ID,
        snapshotId: 'snap-1',
        url: 'https://example.com',
        viewport: '1280x720',
        browser: 'firefox',
        s3Key: 'snapshots/snap-1.png',
        projectId: 'proj-1',
      };
      const diffWhere = vi.fn().mockResolvedValue([diffRow]);
      const innerJoinProxy: any = vi.fn().mockImplementation(() => ({ innerJoin: innerJoinProxy, where: diffWhere }));
      const diffFrom = vi.fn().mockReturnValue({ innerJoin: innerJoinProxy, where: diffWhere });

      let callIndex = 0;
      mockSelect.mockImplementation(() => {
        const returns = [
          { from: authMock.authFrom },
          { from: diffFrom },
        ];
        return returns[callIndex++] || returns[returns.length - 1];
      });

      const server = await createTestApp();
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/diffs/${DIFF_ID}/reject`,
        headers: AUTH_HEADERS,
        payload: { reason: 'wrong color' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
      // Should have inserted only approvalDecision (no baseline)
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when diff not found in workspace', async () => {
      const authMock = mockAuthSuccess();

      const diffWhere = vi.fn().mockResolvedValue([]);
      const innerJoinProxy: any = vi.fn().mockImplementation(() => ({ innerJoin: innerJoinProxy, where: diffWhere }));
      const diffFrom = vi.fn().mockReturnValue({ innerJoin: innerJoinProxy, where: diffWhere });

      let callIndex = 0;
      mockSelect.mockImplementation(() => {
        const returns = [
          { from: authMock.authFrom },
          { from: diffFrom },
        ];
        return returns[callIndex++] || returns[returns.length - 1];
      });

      const server = await createTestApp();
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/diffs/${DIFF_ID}/reject`,
        headers: AUTH_HEADERS,
        payload: {},
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 401 without API key', async () => {
      const server = await createTestApp();
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/diffs/${DIFF_ID}/reject`,
        payload: {},
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
