import { describe, it, expect, vi } from 'vitest';
import type { Redis } from 'ioredis';

describe('validateRedis', () => {
  it('Test 3: validateRedis() throws when maxmemory-policy is not noeviction', async () => {
    const { validateRedis } = await import('../src/workers/validate-redis.js');

    // Mock redis client that returns wrong policy
    const mockRedis = {
      config: vi.fn().mockResolvedValue(['maxmemory-policy', 'allkeys-lru']),
    } as unknown as Redis;

    await expect(validateRedis(mockRedis)).rejects.toThrow(
      /maxmemory-policy must be "noeviction"/
    );
    await expect(validateRedis(mockRedis)).rejects.toThrow(/allkeys-lru/);
  });

  it('Test 4: validateRedis() succeeds when maxmemory-policy is noeviction', async () => {
    const { validateRedis } = await import('../src/workers/validate-redis.js');

    // Mock redis client that returns correct policy
    const mockRedis = {
      config: vi.fn().mockResolvedValue(['maxmemory-policy', 'noeviction']),
    } as unknown as Redis;

    // Should not throw
    await expect(validateRedis(mockRedis)).resolves.toBeUndefined();
  });

  it('Integration: validateRedis() succeeds with actual Redis (if available)', async () => {
    const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    // Try to connect to real Redis - skip if not available
    let redis: Redis | null = null;
    try {
      const { Redis } = await import('ioredis');
      redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        retryStrategy: () => null, // Don't retry on failure
      });

      // Test connection
      await redis.ping();
    } catch {
      // Redis not available — skip integration test
      if (redis) {
        await redis.quit().catch(() => {});
      }
      console.log('Redis not available, skipping integration test');
      return;
    }

    try {
      const { validateRedis } = await import('../src/workers/validate-redis.js');

      // The Docker Compose Redis is configured with --maxmemory-policy noeviction
      // so this should succeed without throwing
      await expect(validateRedis(redis)).resolves.toBeUndefined();
    } finally {
      await redis.quit().catch(() => {});
    }
  });
});
