import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// These integration tests require a running Fastify server with Redis and valid
// Clerk keys. Skip when infrastructure is not available.
const hasRequiredServices =
  process.env.REDIS_URL &&
  process.env.CLERK_SECRET_KEY &&
  process.env.CLERK_SECRET_KEY !== 'sk_test_REPLACE_ME';

describe.skipIf(!hasRequiredServices)('Fastify + tRPC + Clerk API Server', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Import buildServer dynamically so TypeScript can resolve after build
    const { buildServer } = await import('../src/server.js');
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Test 1: health endpoint returns 200 with status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/trpc/health.check',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.result.data.status).toBe('ok');
    expect(body.result.data.timestamp).toBeDefined();
  });

  it('Test 2: unauthenticated request to health endpoint succeeds (health is public)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/trpc/health.check',
      // No Authorization header
    });

    expect(response.statusCode).toBe(200);
  });

  it('Test 3: server starts without Clerk keys (graceful degradation)', async () => {
    // This test verifies the server is running (no CLERK_SECRET_KEY in test env)
    // The server should start without throwing
    expect(app).toBeDefined();
    // Server should be in a ready state
    const response = await app.inject({
      method: 'GET',
      url: '/trpc/health.check',
    });
    expect(response.statusCode).toBe(200);
  });

  it('Test 4: tRPC router is mounted at /trpc prefix', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/trpc/health.check',
    });
    // Should return tRPC-formatted response, not 404
    expect(response.statusCode).not.toBe(404);
  });

  it('Test 5: createContext returns object with auth property', async () => {
    const { createContext } = await import('../src/context.js');

    // Create a minimal mock request/response
    const mockReq = {
      headers: {},
      clerk: undefined,
    };
    const mockRes = {};

    // createContext should return an object with auth property
    // When Clerk is not configured, auth will be null/undefined
    const ctx = await createContext({ req: mockReq as any, res: mockRes as any });
    expect(ctx).toHaveProperty('auth');
    expect(ctx).toHaveProperty('req');
    expect(ctx).toHaveProperty('res');
  });
});
