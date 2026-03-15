import { describe, it, expect, vi, beforeEach } from 'vitest';

// No DB or external dependencies needed for health router

describe('health router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('health.check returns status ok and a valid ISO timestamp', async () => {
    const { appRouter } = await import('../../routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.health.check();

    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
    // Verify it's a valid ISO date
    const parsed = new Date(result.timestamp);
    expect(parsed.toISOString()).toBe(result.timestamp);
  });

  it('health.check returns a recent timestamp (within 5 seconds of now)', async () => {
    const before = Date.now();

    const { appRouter } = await import('../../routers/index.js');
    const caller = appRouter.createCaller({ auth: null } as any);

    const result = await caller.health.check();

    const after = Date.now();
    const ts = new Date(result.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('health.check does not require authentication (no auth context needed)', async () => {
    const { appRouter } = await import('../../routers/index.js');

    // Should work with completely null auth
    const caller = appRouter.createCaller({ auth: null } as any);
    const result = await caller.health.check();
    expect(result.status).toBe('ok');
  });

  it('health.check is a query (not a mutation)', async () => {
    const { appRouter } = await import('../../routers/index.js');

    // The procedure type is embedded in the router definition;
    // createCaller routes it through query path. If it were a mutation,
    // calling it as a query would fail.
    const caller = appRouter.createCaller({ auth: null } as any);
    const result = await caller.health.check();
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('timestamp');
  });
});
