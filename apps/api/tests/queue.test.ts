import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TEST_QUEUE = 'test-queue-' + Math.random().toString(36).slice(2, 8);

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

describe('BullMQ Queue and Worker', async () => {
  const available = await isRedisAvailable();
  if (!available) {
    it.skip('Redis not available — skipping queue tests', () => {});
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
        return { processed: true, jobId: job.id };
      },
      { connection }
    );

    await worker.waitUntilReady();
  });

  afterAll(async () => {
    await worker.close();
    await queue.close();
  });

  it('Test 1: Queue.add() enqueues a job and worker processes it', async () => {
    const processedJobIds: string[] = [];

    // Listen for completed events
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Job did not complete in time')), 15000);

      worker.on('completed', (job) => {
        if (job.id) {
          processedJobIds.push(job.id);
          clearTimeout(timeout);
          resolve();
        }
      });

      // Add a job to the queue
      queue.add('test-job', { data: 'test-payload' }).catch(reject);
    });

    expect(processedJobIds.length).toBeGreaterThan(0);
  });
});
