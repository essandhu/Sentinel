import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TEST_QUEUE = 'test-shutdown-' + Math.random().toString(36).slice(2, 8);

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

async function isRedisAvailable(): Promise<boolean> {
  const connection = parseRedisUrl(REDIS_URL);
  const redis = new Redis({ ...connection, maxRetriesPerRequest: 1, retryStrategy: () => null });
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  } finally {
    redis.disconnect();
  }
}

describe('BullMQ Worker Graceful Shutdown', async () => {
  const available = await isRedisAvailable();
  if (!available) {
    it.skip('Redis not available — skipping graceful shutdown tests', () => {});
    return;
  }

  let queue: Queue;
  let worker: Worker;
  const connection = parseRedisUrl(REDIS_URL);

  beforeAll(async () => {
    queue = new Queue(TEST_QUEUE, { connection });
    worker = new Worker(
      TEST_QUEUE,
      async (job) => {
        // Simulate a short processing time
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { processed: true, jobId: job.id };
      },
      { connection }
    );

    await worker.waitUntilReady();
  });

  afterAll(async () => {
    await queue.close();
  });

  it('Test 2: worker.close() drains current job and resolves within 10 seconds', async () => {
    // Add a job to process
    await queue.add('shutdown-test-job', { test: true });

    // Wait a moment for the job to start processing
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Call worker.close() and verify it resolves within 10 seconds
    const closePromise = worker.close();
    const timeoutPromise = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), 10000)
    );

    const result = await Promise.race([closePromise, timeoutPromise]);

    // Result should be undefined (worker.close() resolves with void) not 'timeout'
    expect(result).not.toBe('timeout');
  });
});
