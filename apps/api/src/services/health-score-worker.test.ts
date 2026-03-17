import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Mock BullMQ ----------
const mockQueueAdd = vi.fn().mockResolvedValue(undefined);
const mockWorkerInstance = {
  on: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(function (this: any) {
    this.add = mockQueueAdd;
  }),
  Worker: vi.fn().mockImplementation(function (this: any) {
    Object.assign(this, mockWorkerInstance);
  }),
}));

// Mock the health score service
vi.mock('./health-score-service.js', () => ({
  computeAllHealthScores: vi.fn().mockResolvedValue(undefined),
}));

// Mock @sentinel-vrt/db
vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => ({})),
}));

// Mock @sentinel-vrt/storage
vi.mock('@sentinel-vrt/storage', () => ({
  createStorageClient: vi.fn(() => ({})),
}));

import { Queue, Worker } from 'bullmq';
import { startHealthScoreWorker, scheduleHourlyAggregation } from './health-score-worker.js';

describe('health-score-worker', () => {
  const connectionOptions = {
    host: 'localhost',
    port: 6379,
    password: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startHealthScoreWorker', () => {
    it('creates a BullMQ Worker on health-scores queue with concurrency 1', async () => {
      await startHealthScoreWorker(connectionOptions);

      expect(Worker).toHaveBeenCalledWith(
        'health-scores',
        expect.any(Function),
        expect.objectContaining({
          concurrency: 1,
        }),
      );
    });

    it('passes connection options with maxRetriesPerRequest: null', async () => {
      await startHealthScoreWorker(connectionOptions);

      expect(Worker).toHaveBeenCalledWith(
        'health-scores',
        expect.any(Function),
        expect.objectContaining({
          connection: expect.objectContaining({
            maxRetriesPerRequest: null,
          }),
        }),
      );
    });
  });

  describe('scheduleHourlyAggregation', () => {
    it('creates a Queue and adds repeatable job with cron pattern', async () => {
      await scheduleHourlyAggregation(connectionOptions);

      expect(Queue).toHaveBeenCalledWith('health-scores', expect.any(Object));
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'compute',
        {},
        expect.objectContaining({
          repeat: { pattern: '0 * * * *' },
          jobId: 'health-score-hourly',
        }),
      );
    });
  });
});
