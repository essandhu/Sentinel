import { randomUUID } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import type { DesignSpec } from '@sentinel/types';
import { uploadBuffer } from '@sentinel/storage';
import { captureRuns, snapshots, baselines, type Db } from '@sentinel/db';

/**
 * Converts an array of DesignSpec objects into S3 uploads and baseline DB rows.
 *
 * For each spec with a referenceImage:
 * 1. Uploads the image to S3 at baselines/{projectId}/{sourceType}/{componentName}.png
 * 2. Creates a synthetic captureRun + snapshot (required FK chain)
 * 3. Inserts a baseline row referencing the snapshot
 *
 * Specs without referenceImage are skipped.
 */
export async function writeDesignBaselines(
  specs: DesignSpec[],
  projectId: string,
  userId: string,
  storageClient: S3Client,
  bucket: string,
  db: Db,
): Promise<{ baselineCount: number }> {
  let baselineCount = 0;

  // Create a single synthetic capture run for this batch of design baselines
  const [captureRun] = await db
    .insert(captureRuns)
    .values({
      projectId,
      status: 'completed',
      source: 'design-sync',
    })
    .returning({ id: captureRuns.id });

  for (const spec of specs) {
    if (!spec.referenceImage) {
      continue;
    }

    const componentName = spec.metadata.componentName ?? randomUUID();
    const s3Key = `baselines/${projectId}/${spec.sourceType}/${componentName}.png`;
    const syntheticUrl = `design://${spec.sourceType}/${componentName}`;

    // Upload reference image to S3
    await uploadBuffer(storageClient, bucket, s3Key, spec.referenceImage, 'image/png');

    // Create synthetic snapshot (required FK for baselines table)
    const [snapshot] = await db
      .insert(snapshots)
      .values({
        runId: captureRun.id,
        url: syntheticUrl,
        viewport: 'original',
        s3Key,
      })
      .returning({ id: snapshots.id });

    // Insert baseline row
    await db.insert(baselines).values({
      projectId,
      url: syntheticUrl,
      viewport: 'original',
      s3Key,
      snapshotId: snapshot.id,
      approvedBy: userId,
    });

    baselineCount++;
  }

  return { baselineCount };
}
