import { Worker, Queue } from 'bullmq';
import { createDb, baselines, captureRuns, type Db } from '@sentinel/db';
import { eq, and, notInArray, max } from 'drizzle-orm';
import type { RedisConnectionOptions } from './parse-redis-url.js';

export const BRANCH_CLEANUP_QUEUE = 'branch-cleanup';

/** Default protected branches that are never cleaned up. */
const DEFAULT_PROTECTED_BRANCHES = ['main', 'develop', 'staging'];

/**
 * Delete baselines for branches whose last capture run is older than the retention period.
 * Protected branches (main, develop, staging) are always excluded.
 *
 * Staleness is determined by the last capture run date for the branch,
 * NOT by the baseline creation date (Pitfall 5 guidance).
 */
export async function cleanStaleBranchBaselines(
  db: Db,
  retentionDays = 30,
  excludeBranches: string[] = DEFAULT_PROTECTED_BRANCHES,
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Find all distinct branch names from baselines, excluding protected branches
  const branches = await db
    .selectDistinct({ branchName: baselines.branchName })
    .from(baselines)
    .where(notInArray(baselines.branchName, excludeBranches));

  let totalDeleted = 0;

  for (const { branchName } of branches) {
    // Check last capture run for this branch
    const [result] = await db
      .select({ lastRun: max(captureRuns.createdAt) })
      .from(captureRuns)
      .where(eq(captureRuns.branchName, branchName));

    const lastRunDate = result?.lastRun;

    // If no capture run exists or last run is older than retention cutoff, delete baselines
    if (!lastRunDate || lastRunDate < cutoff) {
      const deleted = await db
        .delete(baselines)
        .where(eq(baselines.branchName, branchName));

      // drizzle returns rowCount on the result for delete operations
      const rowCount = (deleted as any)?.rowCount ?? 0;
      totalDeleted += rowCount;
    }
  }

  return totalDeleted;
}

/**
 * Start the branch cleanup BullMQ worker.
 * Runs a repeatable job every 24 hours (configurable via BRANCH_CLEANUP_INTERVAL_HOURS).
 */
export async function startBranchCleanupWorker(
  connectionOptions: RedisConnectionOptions,
): Promise<Worker> {
  const intervalHours = parseInt(process.env.BRANCH_CLEANUP_INTERVAL_HOURS ?? '24', 10);
  const retentionDays = parseInt(process.env.BRANCH_CLEANUP_RETENTION_DAYS ?? '30', 10);

  // Create queue and add repeatable job
  const queue = new Queue(BRANCH_CLEANUP_QUEUE, { connection: connectionOptions as any });
  await queue.upsertJobScheduler(
    'branch-cleanup-scheduled',
    { every: intervalHours * 60 * 60 * 1000 },
    { name: 'branch-cleanup', data: { retentionDays } },
  );

  const worker = new Worker(
    BRANCH_CLEANUP_QUEUE,
    async (job) => {
      const db = createDb(process.env.DATABASE_URL!);
      const days = job.data?.retentionDays ?? retentionDays;
      const deleted = await cleanStaleBranchBaselines(db, days);
      console.log(`[branch-cleanup] Cleaned ${deleted} stale branch baselines (retention: ${days} days)`);
      return { deleted };
    },
    {
      connection: connectionOptions as any,
      concurrency: 1,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 50 },
    },
  );

  return worker;
}

// Named export matching plan's expected export name
export const branchCleanupWorker = startBranchCleanupWorker;
