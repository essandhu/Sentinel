import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @clerk/fastify dynamically via vi.mock
const mockGetAuth = vi.fn();

vi.mock('@clerk/fastify', () => ({
  getAuth: mockGetAuth,
}));

describe('createContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns auth data when Clerk getAuth succeeds', async () => {
    const authData = { userId: 'user_123', sessionId: 'sess_abc' };
    mockGetAuth.mockReturnValue(authData);

    const { createContext } = await import('./context.js');

    const req = { headers: {} } as any;
    const res = {} as any;
    const ctx = await createContext({ req, res });

    expect(ctx.auth).toEqual(authData);
    expect(ctx.req).toBe(req);
    expect(ctx.res).toBe(res);
  });

  it('returns null auth when getAuth throws', async () => {
    mockGetAuth.mockImplementation(() => {
      throw new Error('Clerk not registered');
    });

    const { createContext } = await import('./context.js');

    const req = { headers: {} } as any;
    const res = {} as any;
    const ctx = await createContext({ req, res });

    expect(ctx.auth).toBeNull();
    expect(ctx.req).toBe(req);
    expect(ctx.res).toBe(res);
  });
});
