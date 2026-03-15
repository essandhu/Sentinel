import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------- Hoisted mocks ----------
const mockSelect = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockWhere = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockSet = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn());

vi.mock('@sentinel/db', () => ({
  createDb: vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  })),
  apiKeys: {
    id: 'id',
    workspaceId: 'workspace_id',
    keyHash: 'key_hash',
    revokedAt: 'revoked_at',
    lastUsedAt: 'last_used_at',
  },
}));

vi.mock('../../services/api-key-service.js', () => ({
  hashApiKey: vi.fn((key: string) => `hashed_${key}`),
}));

vi.mock('@clerk/fastify', () => ({
  clerkPlugin: vi.fn(),
  getAuth: vi.fn(() => ({ userId: 'user_test123' })),
}));

// Mock ioredis for rate limiter - must be a class constructor
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
// NOTE: REDIS_URL intentionally NOT set so rate limiter uses in-memory store for tests

describe('REST API v1 auth and plugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default: mock DB returns no rows (invalid key)
    mockWhere.mockResolvedValue([]);
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    // Mock update chain
    mockUpdateWhere.mockReturnValue(Promise.resolve());
    (mockUpdateWhere as any).catch = vi.fn();
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  async function createTestApp() {
    const { buildServer } = await import('../../server.js');
    app = await buildServer();
    await app.ready();
    return app;
  }

  it('returns 401 when no API key header present', async () => {
    const server = await createTestApp();
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/',
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Missing API key');
  });

  it('returns 401 for revoked/invalid API key', async () => {
    // mockWhere already returns [] (no matching rows)
    const server = await createTestApp();
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/',
      headers: { 'x-api-key': 'sk_live_invalid' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid or revoked API key');
  });

  it('attaches workspaceId for valid API key via X-API-Key header', async () => {
    mockWhere.mockResolvedValue([
      { id: 'key-uuid-1', workspaceId: 'ws-123' },
    ]);

    const server = await createTestApp();
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/',
      headers: { 'x-api-key': 'sk_live_validkey123' },
    });
    // Should succeed (200) since auth passed
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('Sentinel API');
  });

  it('accepts Authorization: Bearer header', async () => {
    mockWhere.mockResolvedValue([
      { id: 'key-uuid-2', workspaceId: 'ws-456' },
    ]);

    const server = await createTestApp();
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/',
      headers: { authorization: 'Bearer sk_live_bearerkey' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Sentinel API');
  });

  it('/api/v1/docs is accessible without API key (auth skip)', async () => {
    const server = await createTestApp();
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/docs/json',
    });
    // Swagger JSON endpoint should return 200 with OpenAPI spec
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBeDefined();
  });

  it('tRPC routes still respond after v1 plugin registration', async () => {
    const server = await createTestApp();
    const res = await server.inject({
      method: 'GET',
      url: '/trpc',
    });
    // tRPC should not crash with content-type parser error
    // It may return 404 or a tRPC error, but NOT a 500 parser crash
    expect(res.statusCode).not.toBe(500);
  });

  it('rate limit returns 429 after exceeding max requests', async () => {
    // Set a very low rate limit for testing
    process.env.API_RATE_LIMIT_MAX = '3';

    mockWhere.mockResolvedValue([
      { id: 'key-uuid-3', workspaceId: 'ws-789' },
    ]);

    const server = await createTestApp();

    // Make requests up to the limit
    for (let i = 0; i < 3; i++) {
      await server.inject({
        method: 'GET',
        url: '/api/v1/',
        headers: { 'x-api-key': 'sk_live_ratelimitkey' },
      });
    }

    // Next request should be rate limited
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/',
      headers: { 'x-api-key': 'sk_live_ratelimitkey' },
    });
    expect(res.statusCode).toBe(429);

    // Cleanup
    delete process.env.API_RATE_LIMIT_MAX;
  });
});
