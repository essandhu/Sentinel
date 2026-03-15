import type { Redis } from 'ioredis';

export async function validateRedis(redis: Redis): Promise<void> {
  const result = (await redis.config('GET', 'maxmemory-policy')) as string[];
  // ioredis returns an array: [key, value, key, value, ...]
  const policy = result[1];
  if (policy !== 'noeviction') {
    throw new Error(
      `Redis maxmemory-policy must be "noeviction" for BullMQ. Got: "${policy}". Configure in docker-compose.yml: redis-server --maxmemory-policy noeviction`
    );
  }
}
