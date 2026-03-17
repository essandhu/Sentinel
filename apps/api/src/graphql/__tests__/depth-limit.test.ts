import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------- Hoisted mocks ----------
const mockSelect = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockSet = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn());

vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  })),
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
    browser: 'snapshots.browser',
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
  apiKeys: {
    id: 'api_keys.id',
    workspaceId: 'api_keys.workspace_id',
    keyHash: 'api_keys.key_hash',
    revokedAt: 'api_keys.revoked_at',
    lastUsedAt: 'api_keys.last_used_at',
  },
}));

vi.mock('../../services/api-key-service.js', () => ({
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
  isNotNull: vi.fn((col) => ({ _type: 'isNotNull', col })),
  ne: vi.fn((a, b) => ({ _type: 'ne', a, b })),
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  gte: vi.fn((a, b) => ({ _type: 'gte', a, b })),
  inArray: vi.fn((col, vals) => ({ _type: 'inArray', col, vals })),
  count: vi.fn((col) => ({ _type: 'count', col })),
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
const AUTH_HEADERS = { 'x-api-key': VALID_KEY, 'content-type': 'application/json' };
const WORKSPACE_ID = 'ws-test-001';

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

describe('GraphQL depth limiting', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { buildServer } = await import('../../server.js');
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects queries exceeding depth 7', async () => {
    const authMock = mockAuthSuccess();
    mockSelect.mockImplementation(() => ({ from: authMock.authFrom }));

    // Depth 8 query: Query > projects > captureRuns > diffs > id (+ nesting wrappers)
    // Each { } adds a level. We need > 7 levels.
    const deepQuery = `{
      projects {
        captureRuns {
          diffs {
            id
            snapshotUrl
            snapshotViewport
            browser
            baselineS3Key
            diffS3Key
            pixelDiffPercent
            ssimScore
            passed
          }
        }
        components {
          id
          name
          selector
          description
          enabled
        }
        healthScore {
          score
          computedAt
        }
      }
    }`;

    // This is depth 4, let me construct one that's actually > 7.
    // Since we have Project -> captureRuns -> diffs and Project -> components,
    // depth 7 means nesting is fine. We need to go deeper than the schema allows,
    // or we need to request the same fields repeatedly via aliases.
    // Actually, the schema depth for this query is only 4 (Query.projects.captureRuns.diffs.id).
    // To exceed depth 7 with our schema, we'd need types that reference themselves or
    // we rely on Mercurius rejecting at the SDL parsing level.
    // Let's construct a deeply nested introspection query instead.

    const excessiveDepthQuery = `{
      __schema {
        types {
          fields {
            type {
              fields {
                type {
                  fields {
                    type {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`;

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: excessiveDepthQuery },
      headers: AUTH_HEADERS,
    });

    // Mercurius should reject with 400 for depth limit exceeded
    const body = response.json();
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);
    const errorMessage = body.errors.map((e: any) => e.message).join(' ');
    expect(errorMessage.toLowerCase()).toMatch(/depth/);
  });

  it('allows queries within depth 7', async () => {
    const authMock = mockAuthSuccess();
    const projectData = [
      { id: 'proj-1', name: 'Test', createdAt: new Date('2025-01-01') },
    ];

    let callIndex = 0;
    mockSelect.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return { from: authMock.authFrom };
      // projects query
      const where = vi.fn().mockResolvedValue(projectData);
      const from = vi.fn().mockReturnValue({ where });
      return { from };
    });

    // Depth 3: Query -> projects -> id, name
    const shallowQuery = '{ projects { id name } }';

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: shallowQuery },
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.errors).toBeUndefined();
    expect(body.data.projects).toBeDefined();
  });
});
