import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Mock @clerk/fastify for getAuth behavior
const mockGetAuth = vi.fn();
vi.mock('@clerk/fastify', () => ({
  clerkPlugin: vi.fn(),
  getAuth: mockGetAuth,
}));

// Mock @sentinel/storage so the route handler doesn't need real S3
vi.mock('@sentinel/storage', () => ({
  createStorageClient: vi.fn(() => ({})),
}));

// Mock @aws-sdk/s3-request-presigner
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/presigned'),
}));

// Mock @aws-sdk/client-s3
vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: vi.fn(),
}));

// These tests require buildServer() which connects to Redis. Skip when unavailable.
const hasRequiredServices =
  process.env.REDIS_URL &&
  process.env.CLERK_SECRET_KEY &&
  process.env.CLERK_SECRET_KEY !== 'sk_test_REPLACE_ME';

describe.skipIf(!hasRequiredServices)('GET /images/* auth enforcement', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { buildServer } = await import('../src/server.js');
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when CLERK_SECRET_KEY is set but no valid userId', async () => {
    // Simulate Clerk being active
    const origKey = process.env.CLERK_SECRET_KEY;
    process.env.CLERK_SECRET_KEY = 'sk_test_fake';

    mockGetAuth.mockReturnValue({ userId: null });

    try {
      // Rebuild server with CLERK_SECRET_KEY set
      const { buildServer } = await import('../src/server.js');
      const authApp = await buildServer();
      await authApp.ready();

      const response = await authApp.inject({
        method: 'GET',
        url: '/images/test.png',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');

      await authApp.close();
    } finally {
      if (origKey !== undefined) {
        process.env.CLERK_SECRET_KEY = origKey;
      } else {
        delete process.env.CLERK_SECRET_KEY;
      }
    }
  });

  it('passes through when CLERK_SECRET_KEY is not set', async () => {
    // Ensure CLERK_SECRET_KEY is not set
    const origKey = process.env.CLERK_SECRET_KEY;
    delete process.env.CLERK_SECRET_KEY;

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/images/test.png',
      });

      // Should not be 401 — auth not checked when Clerk not configured
      expect(response.statusCode).not.toBe(401);
      // getAuth should NOT have been called
      expect(mockGetAuth).not.toHaveBeenCalled();
    } finally {
      if (origKey !== undefined) {
        process.env.CLERK_SECRET_KEY = origKey;
      }
    }
  });
});
