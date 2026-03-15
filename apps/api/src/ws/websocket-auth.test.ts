import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @clerk/backend before importing the module under test
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}));

import { authenticateWsConnection } from './websocket-auth.js';
import { verifyToken } from '@clerk/backend';

const mockVerifyToken = vi.mocked(verifyToken);

describe('authenticateWsConnection', () => {
  const originalEnv = process.env.CLERK_SECRET_KEY;

  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test_abc123';
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CLERK_SECRET_KEY = originalEnv;
    } else {
      delete process.env.CLERK_SECRET_KEY;
    }
  });

  it('returns {userId, orgId} for valid Clerk JWT', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user_123', org_id: 'org_456' } as any);
    const result = await authenticateWsConnection('valid-token');
    expect(result).toEqual({ userId: 'user_123', orgId: 'org_456' });
    expect(mockVerifyToken).toHaveBeenCalledWith('valid-token', {
      secretKey: 'sk_test_abc123',
    });
  });

  it('returns null for missing token', async () => {
    const result = await authenticateWsConnection(undefined);
    expect(result).toBeNull();
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it('returns null for invalid/expired token', async () => {
    mockVerifyToken.mockRejectedValue(new Error('Token expired'));
    const result = await authenticateWsConnection('expired-token');
    expect(result).toBeNull();
  });

  it('returns null when CLERK_SECRET_KEY is unset', async () => {
    delete process.env.CLERK_SECRET_KEY;
    const result = await authenticateWsConnection('any-token');
    expect(result).toBeNull();
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it('returns null when payload is missing sub claim', async () => {
    mockVerifyToken.mockResolvedValue({ org_id: 'org_456' } as any);
    const result = await authenticateWsConnection('valid-token');
    expect(result).toBeNull();
  });

  it('returns null when payload is missing org_id claim', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user_123' } as any);
    const result = await authenticateWsConnection('valid-token');
    expect(result).toBeNull();
  });
});
