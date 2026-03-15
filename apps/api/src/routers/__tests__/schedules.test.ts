import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test UUIDs
const PROJ_ID = '00000000-0000-4000-a000-000000000001';
const SCHED_ID = '00000000-0000-4000-a000-000000000002';
const RUN_ID_1 = '00000000-0000-4000-a000-000000000003';
const RUN_ID_2 = '00000000-0000-4000-a000-000000000004';
const OTHER_PROJ_ID = '00000000-0000-4000-a000-000000000099';
const WS_ID = 'ws-1';

// Mock ScheduleManager
const mockAddSchedule = vi.fn().mockResolvedValue(undefined);
const mockRemoveSchedule = vi.fn().mockResolvedValue(undefined);
const mockGetNextRun = vi.fn().mockResolvedValue(null);

vi.mock('../../services/schedule-manager.js', () => {
  return {
    ScheduleManager: vi.fn().mockImplementation(function (this: any) {
      this.addSchedule = mockAddSchedule;
      this.removeSchedule = mockRemoveSchedule;
      this.getNextRun = mockGetNextRun;
      this.reconcileSchedules = vi.fn().mockResolvedValue({ added: 0, removed: 0 });
    }),
  };
});

// Mock cron-parser (v5 uses CronExpressionParser.parse() as named export)
vi.mock('cron-parser', () => ({
  CronExpressionParser: {
    parse: vi.fn((expr: string) => {
      if (expr === 'invalid-cron') {
        throw new Error('Invalid cron expression');
      }
      return { hasNext: () => true };
    }),
  },
}));

// Mock cronstrue
vi.mock('cronstrue', () => ({
  default: {
    toString: vi.fn(() => 'Every day at 3:00 AM'),
  },
}));

// Build a chainable mock DB that tracks select call sequence
function buildMockDb(selectResponses: unknown[][] = []) {
  let selectCallIdx = 0;

  const makeSelectChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    // Make it thenable so await resolves to the value
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(fn);
    return chain;
  };

  const db = {
    select: vi.fn(() => {
      const response = selectResponses[selectCallIdx] ?? [];
      selectCallIdx++;
      return makeSelectChain(response);
    }),
    insert: vi.fn(() => {
      const chain: Record<string, any> = {};
      chain.values = vi.fn(() => chain);
      chain.returning = vi.fn();
      chain.then = (fn: (v: unknown) => unknown) =>
        Promise.resolve(undefined).then(fn);
      return chain;
    }),
    update: vi.fn(() => {
      const chain: Record<string, any> = {};
      chain.set = vi.fn(() => chain);
      chain.where = vi.fn(() => chain);
      chain.returning = vi.fn();
      chain.then = (fn: (v: unknown) => unknown) =>
        Promise.resolve(undefined).then(fn);
      return chain;
    }),
    delete: vi.fn(() => {
      const chain: Record<string, any> = {};
      chain.where = vi.fn(() => chain);
      chain.then = (fn: (v: unknown) => unknown) =>
        Promise.resolve(undefined).then(fn);
      return chain;
    }),
  };

  return db;
}

// Allow setting return values for insert/update returning()
function setInsertReturning(db: any, rows: unknown[]) {
  const insertChain = db.insert();
  // Reset to get a fresh reference
  db.insert.mockImplementationOnce(() => {
    const chain: Record<string, any> = {};
    chain.values = vi.fn(() => chain);
    chain.returning = vi.fn().mockResolvedValue(rows);
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(undefined).then(fn);
    return chain;
  });
}

function setUpdateReturning(db: any, rows: unknown[]) {
  db.update.mockImplementationOnce(() => {
    const chain: Record<string, any> = {};
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.returning = vi.fn().mockResolvedValue(rows);
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(undefined).then(fn);
    return chain;
  });
}

// We need mockDb to be accessible from the router code via createDb()
let activeMockDb: any;

vi.mock('@sentinel/db', () => ({
  createDb: vi.fn(() => activeMockDb),
  projects: { id: 'projects.id', workspaceId: 'projects.workspaceId', name: 'projects.name' },
  captureSchedules: {
    id: 'captureSchedules.id',
    projectId: 'captureSchedules.projectId',
    name: 'captureSchedules.name',
    cronExpression: 'captureSchedules.cronExpression',
    timezone: 'captureSchedules.timezone',
    configPath: 'captureSchedules.configPath',
    enabled: 'captureSchedules.enabled',
    lastRunAt: 'captureSchedules.lastRunAt',
    lastRunStatus: 'captureSchedules.lastRunStatus',
    createdBy: 'captureSchedules.createdBy',
    createdAt: 'captureSchedules.createdAt',
    updatedAt: 'captureSchedules.updatedAt',
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.projectId',
    status: 'captureRuns.status',
    source: 'captureRuns.source',
    scheduleId: 'captureRuns.scheduleId',
    createdAt: 'captureRuns.createdAt',
    completedAt: 'captureRuns.completedAt',
  },
  snapshots: { id: 'snapshots.id', runId: 'snapshots.runId', url: 'snapshots.url' },
  diffReports: { id: 'diffReports.id', snapshotId: 'diffReports.snapshotId', passed: 'diffReports.passed' },
  baselines: { id: 'baselines.id' },
  approvalDecisions: { id: 'approvalDecisions.id' },
  workspaceSettings: { id: 'workspaceSettings.id', workspaceId: 'workspaceSettings.workspaceId' },
  components: { id: 'components.id' },
}));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
}));

// Mock trpc with pass-through procedures
vi.mock('../../trpc.js', async () => {
  const { initTRPC } = await import('@trpc/server');
  const t = initTRPC.create();
  return {
    t,
    adminProcedure: t.procedure,
    workspaceProcedure: t.procedure,
  };
});

import { schedulesRouter } from '../schedules.js';
import { initTRPC } from '@trpc/server';

const t = initTRPC.create();
const router = t.router({ schedules: schedulesRouter });
const caller = router.createCaller({});

describe('schedules router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('schedules.create', () => {
    it('creates a schedule with valid cron expression', async () => {
      const newSchedule = {
        id: SCHED_ID,
        projectId: PROJ_ID,
        name: 'Nightly regression',
        cronExpression: '0 3 * * *',
        timezone: 'UTC',
        configPath: './sentinel.yml',
        enabled: 1,
        lastRunAt: null,
        lastRunStatus: null,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // select[0] = project ownership check
      activeMockDb = buildMockDb([
        [{ id: PROJ_ID }], // project check
      ]);

      // Override insert to return the new schedule
      activeMockDb.insert = vi.fn(() => {
        const chain: Record<string, any> = {};
        chain.values = vi.fn(() => chain);
        chain.returning = vi.fn().mockResolvedValue([newSchedule]);
        chain.then = (fn: (v: unknown) => unknown) =>
          Promise.resolve(undefined).then(fn);
        return chain;
      });

      const result = await caller.schedules.create({
        projectId: PROJ_ID,
        name: 'Nightly regression',
        cronExpression: '0 3 * * *',
        configPath: './sentinel.yml',
      });

      expect(result.id).toBe(SCHED_ID);
      expect(result.cronDescription).toBe('Every day at 3:00 AM');
      expect(mockAddSchedule).toHaveBeenCalledWith(
        SCHED_ID,
        '0 3 * * *',
        expect.objectContaining({
          scheduleId: SCHED_ID,
          configPath: './sentinel.yml',
          projectId: PROJ_ID,
        }),
        'UTC',
      );
    });

    it('rejects invalid cron expressions with descriptive error', async () => {
      // Project check passes but cron validation fails
      activeMockDb = buildMockDb([
        [{ id: PROJ_ID }],
      ]);

      await expect(
        caller.schedules.create({
          projectId: PROJ_ID,
          name: 'Bad schedule',
          cronExpression: 'invalid-cron',
          configPath: './sentinel.yml',
        }),
      ).rejects.toThrow('Invalid cron expression');
    });

    it('rejects empty name', async () => {
      activeMockDb = buildMockDb([]);

      await expect(
        caller.schedules.create({
          projectId: PROJ_ID,
          name: '',
          cronExpression: '0 3 * * *',
          configPath: './sentinel.yml',
        }),
      ).rejects.toThrow();
    });

    it('rejects name longer than 100 characters', async () => {
      activeMockDb = buildMockDb([]);

      await expect(
        caller.schedules.create({
          projectId: PROJ_ID,
          name: 'x'.repeat(101),
          cronExpression: '0 3 * * *',
          configPath: './sentinel.yml',
        }),
      ).rejects.toThrow();
    });
  });

  describe('schedules.list', () => {
    it('returns schedules for a project with nextRun and cronDescription', async () => {
      const schedules = [
        {
          id: SCHED_ID,
          projectId: PROJ_ID,
          name: 'Nightly',
          cronExpression: '0 3 * * *',
          timezone: 'UTC',
          configPath: './sentinel.yml',
          enabled: 1,
          lastRunAt: null,
          lastRunStatus: null,
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      activeMockDb = buildMockDb([schedules]);
      mockGetNextRun.mockResolvedValueOnce(1709600000000);

      const result = await caller.schedules.list({ projectId: PROJ_ID });

      expect(result).toHaveLength(1);
      expect(result[0].cronDescription).toBe('Every day at 3:00 AM');
      expect(result[0].nextRun).toBe(1709600000000);
    });

    it('returns null nextRun for disabled schedules', async () => {
      const schedules = [
        {
          id: SCHED_ID,
          projectId: PROJ_ID,
          name: 'Disabled',
          cronExpression: '0 3 * * *',
          timezone: 'UTC',
          configPath: './sentinel.yml',
          enabled: 0,
          lastRunAt: null,
          lastRunStatus: null,
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      activeMockDb = buildMockDb([schedules]);

      const result = await caller.schedules.list({ projectId: PROJ_ID });

      expect(result[0].nextRun).toBeNull();
      expect(mockGetNextRun).not.toHaveBeenCalled();
    });
  });

  describe('schedules.toggle', () => {
    it('enables a schedule and adds BullMQ repeat job', async () => {
      const updatedRow = { id: SCHED_ID, enabled: 1 };
      // select[0] = schedule lookup
      activeMockDb = buildMockDb([
        [{
          id: SCHED_ID,
          projectId: PROJ_ID,
          cronExpression: '0 3 * * *',
          configPath: './sentinel.yml',
          timezone: 'UTC',
          workspaceId: WS_ID,
        }],
      ]);

      activeMockDb.update = vi.fn(() => {
        const chain: Record<string, any> = {};
        chain.set = vi.fn(() => chain);
        chain.where = vi.fn(() => chain);
        chain.returning = vi.fn().mockResolvedValue([updatedRow]);
        chain.then = (fn: (v: unknown) => unknown) =>
          Promise.resolve(undefined).then(fn);
        return chain;
      });

      const result = await caller.schedules.toggle({
        id: SCHED_ID,
        enabled: true,
      });

      expect(result.enabled).toBe(1);
      expect(mockAddSchedule).toHaveBeenCalledWith(
        SCHED_ID,
        '0 3 * * *',
        expect.objectContaining({ scheduleId: SCHED_ID }),
        'UTC',
      );
    });

    it('disables a schedule and removes BullMQ repeat job', async () => {
      const updatedRow = { id: SCHED_ID, enabled: 0 };
      activeMockDb = buildMockDb([
        [{
          id: SCHED_ID,
          projectId: PROJ_ID,
          cronExpression: '0 3 * * *',
          configPath: './sentinel.yml',
          timezone: 'UTC',
          workspaceId: WS_ID,
        }],
      ]);

      activeMockDb.update = vi.fn(() => {
        const chain: Record<string, any> = {};
        chain.set = vi.fn(() => chain);
        chain.where = vi.fn(() => chain);
        chain.returning = vi.fn().mockResolvedValue([updatedRow]);
        chain.then = (fn: (v: unknown) => unknown) =>
          Promise.resolve(undefined).then(fn);
        return chain;
      });

      const result = await caller.schedules.toggle({
        id: SCHED_ID,
        enabled: false,
      });

      expect(result.enabled).toBe(0);
      expect(mockRemoveSchedule).toHaveBeenCalledWith(SCHED_ID);
    });

    it('throws NOT_FOUND for non-existent schedule', async () => {
      activeMockDb = buildMockDb([[]]);

      await expect(
        caller.schedules.toggle({ id: SCHED_ID, enabled: true }),
      ).rejects.toThrow('Schedule not found');
    });
  });

  describe('schedules.delete', () => {
    it('removes BullMQ job and deletes schedule from DB', async () => {
      // select[0] = schedule lookup
      activeMockDb = buildMockDb([
        [{ id: SCHED_ID, workspaceId: WS_ID }],
      ]);

      const result = await caller.schedules.delete({ id: SCHED_ID });

      expect(result).toEqual({ success: true });
      expect(mockRemoveSchedule).toHaveBeenCalledWith(SCHED_ID);
      expect(activeMockDb.delete).toHaveBeenCalled();
    });

    it('throws NOT_FOUND for non-existent schedule', async () => {
      activeMockDb = buildMockDb([[]]);

      await expect(
        caller.schedules.delete({ id: SCHED_ID }),
      ).rejects.toThrow('Schedule not found');
    });
  });

  describe('schedules.history', () => {
    it('returns captureRuns linked to a scheduleId, ordered by createdAt desc', async () => {
      const runs = [
        { id: RUN_ID_2, status: 'completed', source: 'scheduled', createdAt: new Date(), completedAt: new Date() },
        { id: RUN_ID_1, status: 'failed', source: 'scheduled', createdAt: new Date(), completedAt: null },
      ];

      // select[0] = schedule ownership check, select[1] = captureRuns
      activeMockDb = buildMockDb([
        [{ id: SCHED_ID, workspaceId: WS_ID }],
        runs,
      ]);

      const result = await caller.schedules.history({ scheduleId: SCHED_ID });

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('completed');
      expect(result[1].status).toBe('failed');
    });

    it('throws NOT_FOUND when schedule does not exist', async () => {
      activeMockDb = buildMockDb([[]]);

      await expect(
        caller.schedules.history({ scheduleId: SCHED_ID }),
      ).rejects.toThrow('Schedule not found');
    });

    it('respects limit parameter', async () => {
      activeMockDb = buildMockDb([
        [{ id: SCHED_ID, workspaceId: WS_ID }],
        [{ id: RUN_ID_1, status: 'completed', source: 'scheduled', createdAt: new Date(), completedAt: new Date() }],
      ]);

      const result = await caller.schedules.history({ scheduleId: SCHED_ID, limit: 5 });

      expect(result).toHaveLength(1);
    });
  });

  describe('workspace isolation', () => {
    it('cannot create schedule for project in another workspace', async () => {
      // Project ownership check returns empty
      activeMockDb = buildMockDb([[]]);

      await expect(
        caller.schedules.create({
          projectId: OTHER_PROJ_ID,
          name: 'Evil schedule',
          cronExpression: '0 3 * * *',
          configPath: './evil.yml',
        }),
      ).rejects.toThrow('Project does not belong to this workspace');
    });
  });
});
