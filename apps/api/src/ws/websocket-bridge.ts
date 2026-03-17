import { QueueEvents } from 'bullmq';
import { eq } from 'drizzle-orm';
import { createDb, captureRuns, projects } from '@sentinel-vrt/db';
import { wsManager } from './websocket-manager.js';

const db = createDb();

/** Cache: captureRunId -> workspaceId */
const workspaceCache = new Map<string, string>();

/**
 * Resolve the workspace that owns a given captureRunId.
 * Results are cached so repeated progress events for the same run
 * do not hit the database.
 */
async function resolveWorkspaceForJob(captureRunId: string): Promise<string | null> {
  const cached = workspaceCache.get(captureRunId);
  if (cached) return cached;

  try {
    const rows = await db
      .select({ workspaceId: projects.workspaceId })
      .from(captureRuns)
      .innerJoin(projects, eq(captureRuns.projectId, projects.id))
      .where(eq(captureRuns.id, captureRunId));

    if (rows.length === 0) return null;

    const workspaceId = rows[0].workspaceId;
    workspaceCache.set(captureRunId, workspaceId);
    return workspaceId;
  } catch {
    return null;
  }
}

/**
 * Parse job event data, which may be a JSON string or already an object.
 */
function parseData(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return null;
}

/**
 * Start a BullMQ QueueEvents listener that bridges capture queue events
 * to WebSocket clients via the WebSocketManager.
 *
 * Must run in the API server process (not worker) since it needs access
 * to the WebSocket connections.
 *
 * @returns The QueueEvents instance for shutdown cleanup.
 */
export function startQueueEventBridge(
  connectionOptions: Record<string, unknown>,
): QueueEvents {
  const queueEvents = new QueueEvents('capture', {
    connection: connectionOptions as any,
  });

  queueEvents.on('progress', async ({ jobId, data: rawData }: { jobId: string; data: unknown }) => {
    try {
      const data = parseData(rawData);
      if (!data) return;

      const captureRunId = data.captureRunId as string | undefined;
      if (!captureRunId) return;

      const workspaceId = await resolveWorkspaceForJob(captureRunId);
      if (!workspaceId) return;

      wsManager.broadcast(workspaceId, {
        type: 'capture:progress',
        payload: { jobId, ...data },
      });
    } catch {
      // Best-effort: never crash the bridge
    }
  });

  queueEvents.on('completed', async ({ jobId, returnvalue }: { jobId: string; returnvalue: string }) => {
    try {
      const data = parseData(returnvalue);

      // Shard jobs complete individually -- suppress broadcast, aggregate handles final status
      if (data?.type === 'shard') return;

      const captureRunId = data?.captureRunId as string | undefined;
      if (!captureRunId) return;

      const workspaceId = await resolveWorkspaceForJob(captureRunId);
      if (!workspaceId) return;

      // Clear cache entry -- run is done (aggregate or legacy)
      workspaceCache.delete(captureRunId);

      wsManager.broadcast(workspaceId, {
        type: 'capture:completed',
        payload: { jobId },
      });
    } catch {
      // Best-effort
    }
  });

  queueEvents.on('failed', async ({ jobId, failedReason, data: rawData }: { jobId: string; failedReason: string; data?: string }) => {
    try {
      const data = parseData(rawData);

      // Shard failures are handled by the aggregate parent -- suppress broadcast
      if (data?.type === 'shard') return;

      const captureRunId = data?.captureRunId as string | undefined;
      if (!captureRunId) return;

      const workspaceId = await resolveWorkspaceForJob(captureRunId);
      if (!workspaceId) return;

      // Clear cache entry -- run is done
      workspaceCache.delete(captureRunId);

      wsManager.broadcast(workspaceId, {
        type: 'capture:failed',
        payload: { jobId, reason: failedReason },
      });
    } catch {
      // Best-effort
    }
  });

  return queueEvents;
}

/** @internal Test-only: clear the workspace resolution cache */
export function _resetCacheForTesting(): void {
  workspaceCache.clear();
}
