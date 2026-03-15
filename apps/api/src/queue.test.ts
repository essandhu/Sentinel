import { describe, it, expect, vi, afterEach } from 'vitest';

// Queue and FlowProducer are called with `new`, so we mock them as classes.
// We use vi.hoisted so mocks are available even after vi.resetModules().
const mockParseRedisUrl = vi.hoisted(() =>
  vi.fn(() => ({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
  })),
);

const queueInstances = vi.hoisted(() => [] as any[]);
const fpInstances = vi.hoisted(() => [] as any[]);

vi.mock('bullmq', () => {
  return {
    Queue: class MockQueue {
      constructor(...args: any[]) {
        (this as any)._args = args;
        queueInstances.push(this);
      }
    },
    FlowProducer: class MockFlowProducer {
      constructor(...args: any[]) {
        (this as any)._args = args;
        fpInstances.push(this);
      }
    },
  };
});

vi.mock('./workers/parse-redis-url.js', () => ({
  parseRedisUrl: mockParseRedisUrl,
}));

describe('queue', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    process.env.REDIS_URL = originalRedisUrl;
    queueInstances.length = 0;
    fpInstances.length = 0;
  });

  describe('QUEUE_NAME', () => {
    it('is "capture"', async () => {
      vi.resetModules();
      const { QUEUE_NAME } = await import('./queue.js');
      expect(QUEUE_NAME).toBe('capture');
    });
  });

  describe('getCaptureQueue', () => {
    it('throws when REDIS_URL is not set', async () => {
      vi.resetModules();
      delete process.env.REDIS_URL;
      const mod = await import('./queue.js');
      expect(() => mod.getCaptureQueue()).toThrow('REDIS_URL required');
    });

    it('creates Queue with parsed connection (excluding maxRetriesPerRequest)', async () => {
      vi.resetModules();
      mockParseRedisUrl.mockReturnValue({
        host: 'myhost',
        port: 6380,
        maxRetriesPerRequest: null,
      });
      process.env.REDIS_URL = 'redis://myhost:6380';
      const mod = await import('./queue.js');
      mod.getCaptureQueue();

      expect(queueInstances).toHaveLength(1);
      expect(queueInstances[0]._args).toEqual([
        'capture',
        { connection: { host: 'myhost', port: 6380 } },
      ]);
    });

    it('returns same instance on subsequent calls (singleton)', async () => {
      vi.resetModules();
      process.env.REDIS_URL = 'redis://localhost:6379';
      const mod = await import('./queue.js');

      const q1 = mod.getCaptureQueue();
      const q2 = mod.getCaptureQueue();

      expect(q1).toBe(q2);
      expect(queueInstances).toHaveLength(1);
    });
  });

  describe('getFlowProducer', () => {
    it('throws when REDIS_URL is not set', async () => {
      vi.resetModules();
      delete process.env.REDIS_URL;
      const mod = await import('./queue.js');
      expect(() => mod.getFlowProducer()).toThrow('REDIS_URL required');
    });

    it('creates FlowProducer with parsed connection', async () => {
      vi.resetModules();
      mockParseRedisUrl.mockReturnValue({
        host: 'fphost',
        port: 6381,
        maxRetriesPerRequest: null,
      });
      process.env.REDIS_URL = 'redis://fphost:6381';
      const mod = await import('./queue.js');
      mod.getFlowProducer();

      expect(fpInstances).toHaveLength(1);
      expect(fpInstances[0]._args).toEqual([
        { connection: { host: 'fphost', port: 6381 } },
      ]);
    });

    it('returns same instance on subsequent calls (singleton)', async () => {
      vi.resetModules();
      process.env.REDIS_URL = 'redis://localhost:6379';
      const mod = await import('./queue.js');

      const fp1 = mod.getFlowProducer();
      const fp2 = mod.getFlowProducer();

      expect(fp1).toBe(fp2);
      expect(fpInstances).toHaveLength(1);
    });
  });
});
