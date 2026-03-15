import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// API route tests — build a real Fastify server with DISABLE_WORKERS=1
// and no external service dependencies.
// ---------------------------------------------------------------------------

describe('E2E — API Routes', () => {
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
  // tRPC — runs.list
  // -----------------------------------------------------------------------

  it('tRPC: runs.list route exists and responds', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/trpc/runs.list',
    });

    // The route should exist and respond — 200, 400, 401, or 500 are all
    // acceptable because we only want to verify the route is wired up.
    // A 404 would mean the route is not registered.
    expect([200, 400, 401, 500]).toContain(res.statusCode);
  });

  // -----------------------------------------------------------------------
  // REST API v1 — Swagger docs
  // -----------------------------------------------------------------------

  it('REST: GET /api/v1/docs returns Swagger UI', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/docs',
    });

    // Swagger UI typically returns 200 (inline) or 302 (redirect to /docs/)
    expect([200, 302]).toContain(res.statusCode);
  });

  // -----------------------------------------------------------------------
  // GraphQL — introspection
  // -----------------------------------------------------------------------

  it('GraphQL: /graphql endpoint exists and requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ query: '{ __typename }' }),
    });

    // GraphQL endpoint requires API key or Clerk session auth.
    // Without credentials it returns 401, confirming the route is registered.
    expect(res.statusCode).toBe(401);
  });
});
