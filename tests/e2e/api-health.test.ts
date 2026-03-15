import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// API health tests build a real Fastify server with DISABLE_WORKERS=1
// and SQLite backing. No external services required.
// ---------------------------------------------------------------------------

describe('API Health & tRPC Connectivity', () => {
  let app: FastifyInstance;
  let savedClerkKey: string | undefined;

  beforeAll(async () => {
    // Disable Clerk auth for E2E tests
    savedClerkKey = process.env.CLERK_SECRET_KEY;
    delete process.env.CLERK_SECRET_KEY;

    // Enable local mode — disable workers, use defaults
    process.env.DISABLE_WORKERS = '1';
    process.env.LOG_LEVEL = 'silent';

    // Build the Fastify server (does not listen on a port)
    const { buildServer } = await import('../../apps/api/src/server.js');
    app = await buildServer();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    // Restore CLERK_SECRET_KEY if it was set before
    if (savedClerkKey !== undefined) {
      process.env.CLERK_SECRET_KEY = savedClerkKey;
    }
  });

  // -----------------------------------------------------------------------
  // GET /health
  // -----------------------------------------------------------------------
  it('GET /health returns 200 with { status: "ok" }', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  // -----------------------------------------------------------------------
  // tRPC health.check
  // -----------------------------------------------------------------------
  it('tRPC health.check returns status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/trpc/health.check',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    // tRPC wraps the result in { result: { data: ... } }
    const data = body?.result?.data;
    expect(data).toBeDefined();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });
});
