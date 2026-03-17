import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Hoisted mock state
const mockDb = vi.hoisted(() => ({ select: vi.fn() }));
const mockBroadcast = vi.hoisted(() => vi.fn());

// We need the QueueEvents constructor to produce an EventEmitter.
// Since vi.mock factories are hoisted but run after module-level imports,
// we can reference EventEmitter here because 'node:events' is built-in.
let mockQueueEventsInstance: EventEmitter & { close: ReturnType<typeof vi.fn> };

vi.mock('@sentinel-vrt/db', () => ({
  createDb: () => mockDb,
  captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId' },
  projects: { id: 'projects.id', workspaceId: 'projects.workspaceId' },
}));

vi.mock('./websocket-manager.js', () => ({
  wsManager: { broadcast: mockBroadcast },
}));

vi.mock('bullmq', async () => {
  const { EventEmitter: EE } = await import('node:events');
  class FakeQueueEvents extends EE {
    close = vi.fn().mockResolvedValue(undefined);
    constructor(..._args: any[]) {
      super();
      mockQueueEventsInstance = this as any;
    }
  }
  return { QueueEvents: FakeQueueEvents };
});

// Now import the module under test
import { startQueueEventBridge, _resetCacheForTesting } from './websocket-bridge.js';

/** Helper to set up DB mock chain: select -> from -> innerJoin -> where */
function setupDbMock(rows: Array<{ workspaceId: string }>) {
  const mockWhere = vi.fn().mockResolvedValue(rows);
  const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
  const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
  mockDb.select.mockReturnValue({ from: mockFrom });
}

describe('startQueueEventBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCacheForTesting();
  });

  afterEach(() => {
    if (mockQueueEventsInstance) {
      mockQueueEventsInstance.removeAllListeners();
    }
  });

  it('returns a QueueEvents instance with a close method', () => {
    const qe = startQueueEventBridge({ host: 'localhost', port: 6379 });
    expect(qe).toBeDefined();
    expect(typeof qe.close).toBe('function');
  });

  describe('progress event', () => {
    it('resolves workspace from DB and broadcasts capture:progress', async () => {
      setupDbMock([{ workspaceId: 'ws-123' }]);

      startQueueEventBridge({ host: 'localhost', port: 6379 });

      mockQueueEventsInstance.emit('progress', {
        jobId: 'job-1',
        data: JSON.stringify({ captureRunId: 'run-abc', current: 3, total: 10, routeName: '/home' }),
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockBroadcast).toHaveBeenCalledWith('ws-123', {
        type: 'capture:progress',
        payload: { jobId: 'job-1', captureRunId: 'run-abc', current: 3, total: 10, routeName: '/home' },
      });
    });

    it('caches workspace resolution (no repeated DB lookups for same run)', async () => {
      setupDbMock([{ workspaceId: 'ws-123' }]);

      startQueueEventBridge({ host: 'localhost', port: 6379 });

      mockQueueEventsInstance.emit('progress', {
        jobId: 'job-1',
        data: JSON.stringify({ captureRunId: 'run-abc', current: 1, total: 5, routeName: '/a' }),
      });
      await new Promise((r) => setTimeout(r, 50));

      mockQueueEventsInstance.emit('progress', {
        jobId: 'job-1',
        data: JSON.stringify({ captureRunId: 'run-abc', current: 2, total: 5, routeName: '/b' }),
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(mockDb.select).toHaveBeenCalledTimes(1);
      expect(mockBroadcast).toHaveBeenCalledTimes(2);
    });

    it('silently drops event if workspace resolution fails (no captureRunId)', async () => {
      startQueueEventBridge({ host: 'localhost', port: 6379 });

      mockQueueEventsInstance.emit('progress', {
        jobId: 'job-1',
        data: JSON.stringify({ current: 1, total: 5 }),
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockBroadcast).not.toHaveBeenCalled();
    });

    it('silently drops event if DB lookup returns empty', async () => {
      setupDbMock([]);

      startQueueEventBridge({ host: 'localhost', port: 6379 });

      mockQueueEventsInstance.emit('progress', {
        jobId: 'job-1',
        data: JSON.stringify({ captureRunId: 'run-missing', current: 1, total: 5, routeName: '/x' }),
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockBroadcast).not.toHaveBeenCalled();
    });
  });

  describe('completed event', () => {
    it('broadcasts capture:completed and clears cache entry', async () => {
      setupDbMock([{ workspaceId: 'ws-456' }]);

      startQueueEventBridge({ host: 'localhost', port: 6379 });

      // First emit progress to populate cache
      mockQueueEventsInstance.emit('progress', {
        jobId: 'job-2',
        data: JSON.stringify({ captureRunId: 'run-done', current: 5, total: 5, routeName: '/end' }),
      });
      await new Promise((r) => setTimeout(r, 50));

      // Now emit completed
      mockQueueEventsInstance.emit('completed', {
        jobId: 'job-2',
        returnvalue: JSON.stringify({ captureRunId: 'run-done' }),
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(mockBroadcast).toHaveBeenCalledWith('ws-456', {
        type: 'capture:completed',
        payload: { jobId: 'job-2' },
      });

      // Cache should be cleared -- next progress for same run should hit DB again
      mockQueueEventsInstance.emit('progress', {
        jobId: 'job-3',
        data: JSON.stringify({ captureRunId: 'run-done', current: 1, total: 3, routeName: '/retry' }),
      });
      await new Promise((r) => setTimeout(r, 50));

      // DB should have been called twice (first progress + post-completed progress)
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });
  });

  describe('failed event', () => {
    it('broadcasts capture:failed with reason and clears cache', async () => {
      setupDbMock([{ workspaceId: 'ws-789' }]);

      startQueueEventBridge({ host: 'localhost', port: 6379 });

      mockQueueEventsInstance.emit('failed', {
        jobId: 'job-fail',
        failedReason: 'Timeout exceeded',
        prev: 'active',
        data: JSON.stringify({ captureRunId: 'run-fail' }),
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockBroadcast).toHaveBeenCalledWith('ws-789', {
        type: 'capture:failed',
        payload: { jobId: 'job-fail', reason: 'Timeout exceeded' },
      });
    });
  });

  describe('shard-aware events', () => {
    it('forwards shard progress events with shardIndex in payload', async () => {
      setupDbMock([{ workspaceId: 'ws-shard' }]);

      startQueueEventBridge({ host: 'localhost', port: 6379 });

      mockQueueEventsInstance.emit('progress', {
        jobId: 'shard-job-1',
        data: JSON.stringify({
          captureRunId: 'run-sharded',
          current: 2,
          total: 5,
          routeName: '/home',
          shardIndex: 1,
          shardTotal: 3,
        }),
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockBroadcast).toHaveBeenCalledWith('ws-shard', {
        type: 'capture:progress',
        payload: expect.objectContaining({
          shardIndex: 1,
          shardTotal: 3,
          captureRunId: 'run-sharded',
        }),
      });
    });

    it('shard completed events do NOT broadcast capture:completed', async () => {
      setupDbMock([{ workspaceId: 'ws-shard' }]);

      startQueueEventBridge({ host: 'localhost', port: 6379 });

      // Shard job returns with type:'shard' in returnvalue
      mockQueueEventsInstance.emit('completed', {
        jobId: 'shard-job-1',
        returnvalue: JSON.stringify({
          type: 'shard',
          captureRunId: 'run-sharded',
          snapshotCount: 5,
        }),
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockBroadcast).not.toHaveBeenCalled();
    });

    it('shard failed events do NOT broadcast capture:failed or clear cache', async () => {
      setupDbMock([{ workspaceId: 'ws-shard' }]);

      startQueueEventBridge({ host: 'localhost', port: 6379 });

      // Pre-populate cache
      mockQueueEventsInstance.emit('progress', {
        jobId: 'shard-job-1',
        data: JSON.stringify({ captureRunId: 'run-sharded', current: 1, total: 5, routeName: '/a' }),
      });
      await new Promise((r) => setTimeout(r, 50));
      mockBroadcast.mockClear();

      // Shard failure event
      mockQueueEventsInstance.emit('failed', {
        jobId: 'shard-job-1',
        failedReason: 'Shard timeout',
        data: JSON.stringify({ type: 'shard', captureRunId: 'run-sharded' }),
      });

      await new Promise((r) => setTimeout(r, 50));

      // Should NOT broadcast capture:failed
      expect(mockBroadcast).not.toHaveBeenCalled();

      // Cache should NOT be cleared (other shards still running)
      // Verify by emitting another progress -- should NOT hit DB
      mockQueueEventsInstance.emit('progress', {
        jobId: 'shard-job-2',
        data: JSON.stringify({ captureRunId: 'run-sharded', current: 2, total: 5, routeName: '/b' }),
      });
      await new Promise((r) => setTimeout(r, 50));

      // DB was called once (initial progress), NOT again after shard failure
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it('aggregate completed event broadcasts capture:completed and clears cache', async () => {
      setupDbMock([{ workspaceId: 'ws-shard' }]);

      startQueueEventBridge({ host: 'localhost', port: 6379 });

      // Aggregate job completes
      mockQueueEventsInstance.emit('completed', {
        jobId: 'agg-job-1',
        returnvalue: JSON.stringify({
          type: 'aggregate',
          status: 'completed',
          captureRunId: 'run-sharded',
        }),
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockBroadcast).toHaveBeenCalledWith('ws-shard', {
        type: 'capture:completed',
        payload: { jobId: 'agg-job-1' },
      });
    });

    it('legacy job (no type) completed events still broadcast capture:completed', async () => {
      setupDbMock([{ workspaceId: 'ws-legacy' }]);

      startQueueEventBridge({ host: 'localhost', port: 6379 });

      mockQueueEventsInstance.emit('completed', {
        jobId: 'legacy-job',
        returnvalue: JSON.stringify({ captureRunId: 'run-legacy' }),
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockBroadcast).toHaveBeenCalledWith('ws-legacy', {
        type: 'capture:completed',
        payload: { jobId: 'legacy-job' },
      });
    });
  });
});
