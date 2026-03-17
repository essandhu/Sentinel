import { eq, and, desc } from 'drizzle-orm';
import { snapshots, captureRuns, environmentDiffs } from '@sentinel-vrt/db';
import type { Db } from '@sentinel-vrt/db';
import { runDualDiff } from '@sentinel-vrt/capture';
import type { DiffResult } from '@sentinel-vrt/capture';
import { createHash } from 'node:crypto';

/**
 * Storage adapter interface for downloading/uploading image buffers.
 * Abstracts S3/MinIO access for testability.
 */
export interface StorageAdapter {
  download(bucket: string, key: string): Promise<Buffer>;
  upload(bucket: string, key: string, body: Buffer, contentType: string): Promise<void>;
}

/**
 * Find the latest snapshot for a given project+environment+url+viewport+browser combo.
 * Joins snapshots with captureRuns to filter by environmentName.
 */
export async function findLatestEnvSnapshot(
  db: Db,
  projectId: string,
  environmentName: string,
  url: string,
  viewport: string,
  browser: string,
): Promise<{ id: string; s3Key: string; capturedAt: Date } | null> {
  const results = await db
    .select({
      id: snapshots.id,
      s3Key: snapshots.s3Key,
      capturedAt: snapshots.capturedAt,
    })
    .from(snapshots)
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .where(
      and(
        eq(captureRuns.projectId, projectId),
        eq(captureRuns.environmentName, environmentName),
        eq(snapshots.url, url),
        eq(snapshots.viewport, viewport),
        eq(snapshots.browser, browser),
      ),
    )
    .orderBy(desc(snapshots.capturedAt))
    .limit(1);

  return results[0] ?? null;
}

export type EnvironmentDiffResult =
  | { status: 'missing_snapshot'; missingEnv: string }
  | { status: 'cached'; diff: CachedDiffData }
  | { status: 'computed'; diff: ComputedDiffData };

interface CachedDiffData {
  pixelDiffPercent: number | null;
  ssimScore: number | null;
  passed: string;
  diffS3Key: string;
  sourceSnapshotId: string;
  targetSnapshotId: string;
}

interface ComputedDiffData {
  pixelDiffPercent: number;
  ssimScore: number | null;
  passed: boolean;
  diffS3Key: string;
  sourceSnapshotId: string;
  targetSnapshotId: string;
}

/**
 * Compute or return cached cross-environment diff.
 *
 * 1. Finds latest snapshots for both environments
 * 2. Returns missing_snapshot if either is absent
 * 3. Checks environmentDiffs cache for matching snapshot IDs
 * 4. If cached, returns cached result
 * 5. Otherwise downloads images, runs runDualDiff, uploads diff, caches result
 */
export async function computeEnvironmentDiff(
  db: Db,
  storage: StorageAdapter,
  bucket: string,
  opts: {
    projectId: string;
    sourceEnv: string;
    targetEnv: string;
    url: string;
    viewport: string;
    browser: string;
  },
): Promise<EnvironmentDiffResult> {
  // Find latest snapshots for both environments
  const sourceSnap = await findLatestEnvSnapshot(
    db, opts.projectId, opts.sourceEnv, opts.url, opts.viewport, opts.browser,
  );
  const targetSnap = await findLatestEnvSnapshot(
    db, opts.projectId, opts.targetEnv, opts.url, opts.viewport, opts.browser,
  );

  if (!sourceSnap) {
    return { status: 'missing_snapshot', missingEnv: opts.sourceEnv };
  }
  if (!targetSnap) {
    return { status: 'missing_snapshot', missingEnv: opts.targetEnv };
  }

  // Check cache: do we already have a diff for these exact snapshot IDs?
  const cached = await db
    .select()
    .from(environmentDiffs)
    .where(
      and(
        eq(environmentDiffs.projectId, opts.projectId),
        eq(environmentDiffs.sourceEnv, opts.sourceEnv),
        eq(environmentDiffs.targetEnv, opts.targetEnv),
        eq(environmentDiffs.url, opts.url),
        eq(environmentDiffs.viewport, opts.viewport),
        eq(environmentDiffs.browser, opts.browser),
        eq(environmentDiffs.sourceSnapshotId, sourceSnap.id),
        eq(environmentDiffs.targetSnapshotId, targetSnap.id),
      ),
    )
    .limit(1);

  if (cached.length > 0) {
    const row = cached[0];
    return {
      status: 'cached',
      diff: {
        pixelDiffPercent: row.pixelDiffPercent,
        ssimScore: row.ssimScore,
        passed: row.passed,
        diffS3Key: row.diffS3Key,
        sourceSnapshotId: row.sourceSnapshotId,
        targetSnapshotId: row.targetSnapshotId,
      },
    };
  }

  // No cache hit: download both images and run diff
  const [sourceBuffer, targetBuffer] = await Promise.all([
    storage.download(bucket, sourceSnap.s3Key),
    storage.download(bucket, targetSnap.s3Key),
  ]);

  // Default thresholds for cross-environment comparison
  const thresholds = { pixelDiffPercent: 100, ssimMin: 9500 };
  const diffResult: DiffResult = await runDualDiff(sourceBuffer, targetBuffer, thresholds);

  // Upload diff image to S3
  const urlHash = createHash('md5').update(opts.url).digest('hex').slice(0, 12);
  const diffS3Key = `diffs/env/${opts.projectId}/${opts.sourceEnv}-vs-${opts.targetEnv}/${urlHash}/${opts.viewport}/${opts.browser}.png`;

  await storage.upload(bucket, diffS3Key, diffResult.diffImageBuffer, 'image/png');

  // Cache the result in environmentDiffs table
  await db.insert(environmentDiffs).values({
    projectId: opts.projectId,
    sourceEnv: opts.sourceEnv,
    targetEnv: opts.targetEnv,
    url: opts.url,
    viewport: opts.viewport,
    browser: opts.browser,
    sourceSnapshotId: sourceSnap.id,
    targetSnapshotId: targetSnap.id,
    diffS3Key,
    pixelDiffPercent: diffResult.pixelDiffPercent,
    ssimScore: diffResult.ssimScore,
    passed: diffResult.passed ? 'true' : 'false',
  });

  return {
    status: 'computed',
    diff: {
      pixelDiffPercent: diffResult.pixelDiffPercent,
      ssimScore: diffResult.ssimScore,
      passed: diffResult.passed,
      diffS3Key,
      sourceSnapshotId: sourceSnap.id,
      targetSnapshotId: targetSnap.id,
    },
  };
}

/**
 * List distinct routes (url+viewport+browser) captured for a given environment.
 */
export async function listEnvironmentRoutes(
  db: Db,
  projectId: string,
  environmentName: string,
): Promise<Array<{ url: string; viewport: string; browser: string }>> {
  return db
    .selectDistinct({
      url: snapshots.url,
      viewport: snapshots.viewport,
      browser: snapshots.browser,
    })
    .from(snapshots)
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .where(
      and(
        eq(captureRuns.projectId, projectId),
        eq(captureRuns.environmentName, environmentName),
      ),
    );
}
