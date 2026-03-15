import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// API server route tests — build a real Fastify server with DISABLE_WORKERS=1
// and no external service dependencies.
// ---------------------------------------------------------------------------

describe('E2E — API Server Routes', () => {
  let app: FastifyInstance;
  let savedClerkKey: string | undefined;

  beforeAll(async () => {
    // Preserve and remove CLERK_SECRET_KEY so the server skips Clerk auth
    savedClerkKey = process.env.CLERK_SECRET_KEY;
    delete process.env.CLERK_SECRET_KEY;

    // Enable local mode
    process.env.DISABLE_WORKERS = '1';
    process.env.LOG_LEVEL = 'silent';

    // Build the Fastify server (does NOT listen — we use inject())
    const { buildServer } = await import('../../apps/api/src/server.js');
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    // Restore CLERK_SECRET_KEY
    if (savedClerkKey !== undefined) {
      process.env.CLERK_SECRET_KEY = savedClerkKey;
    }
  });

  // -----------------------------------------------------------------------
  // Health endpoint
  // -----------------------------------------------------------------------

  it('GET /health returns { status: "ok" }', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  // -----------------------------------------------------------------------
  // Image route
  // -----------------------------------------------------------------------

  it('GET /images/* returns 400 when key is empty', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/images/',
    });

    // An empty key should yield a 400 error
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('Missing image key');
  });

  // -----------------------------------------------------------------------
  // tRPC routes — verify wiring (not 404)
  // -----------------------------------------------------------------------

  it('tRPC: projects.list route exists and responds', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/trpc/projects.list',
    });

    // Route should exist — 200, 400, 401, or 500 are acceptable.
    // A 404 means the route is not registered.
    expect([200, 400, 401, 500]).toContain(res.statusCode);
  });

  it('tRPC: components.list route exists and responds', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/trpc/components.list',
    });

    expect([200, 400, 401, 500]).toContain(res.statusCode);
  });

  it('tRPC: health.check returns status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/trpc/health.check',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    const data = body?.result?.data;
    expect(data).toBeDefined();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Webhook routes — verify they exist
  // -----------------------------------------------------------------------

  it('POST /webhooks/figma route exists', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/figma',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({}),
    });

    // Route should be registered — any non-404 status is acceptable
    expect(res.statusCode).not.toBe(404);
  });

  it('POST /webhooks/github route exists', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({}),
    });

    // Route should be registered — any non-404 status is acceptable
    expect(res.statusCode).not.toBe(404);
  });

  // -----------------------------------------------------------------------
  // WebSocket upgrade at /ws
  // -----------------------------------------------------------------------

  it('GET /ws route is registered on the server', async () => {
    const routes = app.printRoutes({ commonPrefix: false });
    expect(routes).toContain('/ws');
  });

  // -----------------------------------------------------------------------
  // GraphQL endpoint
  // -----------------------------------------------------------------------

  it('POST /graphql returns 401 without auth credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ query: '{ __typename }' }),
    });

    // GraphQL endpoint requires API key or Clerk session auth
    expect(res.statusCode).toBe(401);
  });

  // -----------------------------------------------------------------------
  // REST API v1 — Swagger docs
  // -----------------------------------------------------------------------

  it('GET /api/v1/docs returns Swagger UI', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/docs',
    });

    expect([200, 302]).toContain(res.statusCode);
  });
});
