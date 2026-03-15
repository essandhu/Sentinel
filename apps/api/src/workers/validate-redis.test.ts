import { describe, it, expect, vi } from 'vitest';
import { validateRedis } from './validate-redis.js';

function createMockRedis(policy: string) {
  return {
    config: vi.fn().mockResolvedValue(['maxmemory-policy', policy]),
  };
}

describe('validateRedis', () => {
  it('resolves when maxmemory-policy is noeviction', async () => {
    const redis = createMockRedis('noeviction');
    await expect(validateRedis(redis as any)).resolves.toBeUndefined();
    expect(redis.config).toHaveBeenCalledWith('GET', 'maxmemory-policy');
  });

  it('throws when maxmemory-policy is allkeys-lru', async () => {
    const redis = createMockRedis('allkeys-lru');
    await expect(validateRedis(redis as any)).rejects.toThrow(/noeviction/);
    await expect(validateRedis(redis as any)).rejects.toThrow(/allkeys-lru/);
  });

  it('throws when maxmemory-policy is volatile-lru', async () => {
    const redis = createMockRedis('volatile-lru');
    await expect(validateRedis(redis as any)).rejects.toThrow(/noeviction/);
  });

  it('throws with helpful message mentioning docker-compose', async () => {
    const redis = createMockRedis('allkeys-random');
    await expect(validateRedis(redis as any)).rejects.toThrow(/docker-compose/);
  });

  it('includes the actual policy in the error message', async () => {
    const redis = createMockRedis('volatile-ttl');
    await expect(validateRedis(redis as any)).rejects.toThrow('volatile-ttl');
  });
});
