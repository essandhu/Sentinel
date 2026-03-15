import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the queue module so ScheduleManager doesn't try to connect to Redis
vi.mock('../queue.js', () => ({
  getCaptureQueue: vi.fn(() => buildMockQueue()),
}));

function buildMockQueue(repeatableJobs: any[] = []) {
  return {
    add: vi.fn(),
    getRepeatableJobs: vi.fn(() => Promise.resolve(repeatableJobs)),
    removeRepeatableByKey: vi.fn(),
  };
}

import { ScheduleManager } from './schedule-manager.js';

const SCHEDULE_ID = 'sched-001';
const CRON = '0 9 * * 1-5';
const JOB_DATA = {
  scheduleId: SCHEDULE_ID,
  configPath: '/configs/test.json',
  projectId: 'proj-1',
};

describe('ScheduleManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addSchedule', () => {
    it('calls queue.add with correct repeat options', async () => {
      const queue = buildMockQueue();
      const manager = new ScheduleManager(queue as any);

      await manager.addSchedule(SCHEDULE_ID, CRON, JOB_DATA);

      expect(queue.add).toHaveBeenCalledWith(
        'capture',
        { ...JOB_DATA, source: 'scheduled' },
        {
          repeat: { pattern: CRON },
          jobId: `schedule:${SCHEDULE_ID}`,
        },
      );
    });

    it('includes timezone when provided', async () => {
      const queue = buildMockQueue();
      const manager = new ScheduleManager(queue as any);

      await manager.addSchedule(SCHEDULE_ID, CRON, JOB_DATA, 'America/New_York');

      expect(queue.add).toHaveBeenCalledWith(
        'capture',
        { ...JOB_DATA, source: 'scheduled' },
        {
          repeat: { pattern: CRON, tz: 'America/New_York' },
          jobId: `schedule:${SCHEDULE_ID}`,
        },
      );
    });
  });

  describe('removeSchedule', () => {
    it('finds and removes matching repeatable job', async () => {
      const queue = buildMockQueue([
        { id: `schedule:${SCHEDULE_ID}`, key: 'capture:schedule:sched-001:::0 9 * * 1-5' },
      ]);
      const manager = new ScheduleManager(queue as any);

      await manager.removeSchedule(SCHEDULE_ID);

      expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(
        'capture:schedule:sched-001:::0 9 * * 1-5',
      );
    });

    it('does nothing when no match found', async () => {
      const queue = buildMockQueue([]);
      const manager = new ScheduleManager(queue as any);

      await manager.removeSchedule(SCHEDULE_ID);

      expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
    });
  });

  describe('getNextRun', () => {
    it('returns next timestamp when found', async () => {
      const nextTimestamp = 1710000000000;
      const queue = buildMockQueue([
        { id: `schedule:${SCHEDULE_ID}`, key: 'key1', next: nextTimestamp },
      ]);
      const manager = new ScheduleManager(queue as any);

      const result = await manager.getNextRun(SCHEDULE_ID);

      expect(result).toBe(nextTimestamp);
    });

    it('returns null when not found', async () => {
      const queue = buildMockQueue([]);
      const manager = new ScheduleManager(queue as any);

      const result = await manager.getNextRun(SCHEDULE_ID);

      expect(result).toBeNull();
    });
  });

  describe('reconcileSchedules', () => {
    it('adds missing schedules', async () => {
      const queue = buildMockQueue([]); // No existing jobs
      const manager = new ScheduleManager(queue as any);

      const schedules = [
        {
          id: 'sched-new',
          cronExpression: '0 8 * * *',
          configPath: '/configs/new.json',
          projectId: 'proj-2',
          timezone: 'UTC',
        },
      ];

      const result = await manager.reconcileSchedules(schedules);

      expect(result.added).toBe(1);
      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith(
        'capture',
        expect.objectContaining({
          scheduleId: 'sched-new',
          source: 'scheduled',
        }),
        expect.objectContaining({
          repeat: { pattern: '0 8 * * *', tz: 'UTC' },
          jobId: 'schedule:sched-new',
        }),
      );
    });

    it('removes orphaned schedules', async () => {
      const queue = buildMockQueue([
        { id: 'schedule:orphan-1', key: 'capture:schedule:orphan-1:::0 * * * *' },
        { id: 'schedule:keep-1', key: 'capture:schedule:keep-1:::0 9 * * *' },
      ]);
      const manager = new ScheduleManager(queue as any);

      const schedules = [
        {
          id: 'keep-1',
          cronExpression: '0 9 * * *',
          configPath: '/configs/keep.json',
          projectId: 'proj-1',
          timezone: 'UTC',
        },
      ];

      const result = await manager.reconcileSchedules(schedules);

      expect(result.removed).toBe(1);
      expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(
        'capture:schedule:orphan-1:::0 * * * *',
      );
    });
  });
});
