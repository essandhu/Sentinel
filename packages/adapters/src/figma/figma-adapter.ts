import { S3Client } from '@aws-sdk/client-s3';
import pLimit from 'p-limit';
import { createDb, type Db, adapterState } from '@sentinel-vrt/db';
import { eq } from 'drizzle-orm';
import type { DesignSourceAdapter, DesignSpec } from '@sentinel-vrt/types';
import type { FigmaAdapterConfig } from '../types.js';
import {
  fetchFigmaImages,
  FigmaRateLimitError,
} from './figma-client.js';
import {
  figmaCacheKey,
  checkCacheHit,
  readFromCache,
  writeToCache,
} from './figma-cache.js';

export interface FigmaAdapterDeps {
  db: Db;
  s3: S3Client;
  /** Override for testing rate limit check */
  isRateLimitedFn?: (dbConnectionString: string) => Promise<boolean>;
  /** Override for testing rate limit persistence */
  persistRateLimitFn?: (
    dbConnectionString: string,
    retryAfterTimestampMs: number,
    limitType: string | null,
  ) => Promise<void>;
}

/**
 * Checks whether the Figma adapter is currently rate-limited.
 * Reads the adapter_state table in PostgreSQL to survive process restarts.
 */
export async function isRateLimited(dbConnectionString: string): Promise<boolean> {
  const db = createDb(dbConnectionString);
  const row = await db.query.adapterState.findFirst({
    where: eq(adapterState.adapterName, 'figma'),
  });

  if (!row || !row.retryAfterTimestamp) {
    return false;
  }

  return row.retryAfterTimestamp.getTime() > Date.now();
}

/**
 * Persists a rate limit lockout to PostgreSQL so that it survives process restarts.
 * Uses upsert (INSERT ... ON CONFLICT DO UPDATE) keyed on adapter_name = 'figma'.
 */
export async function persistRateLimit(
  dbConnectionString: string,
  retryAfterTimestampMs: number,
  limitType: string | null,
): Promise<void> {
  const db = createDb(dbConnectionString);
  const retryAfterTimestamp = new Date(retryAfterTimestampMs);

  await db
    .insert(adapterState)
    .values({
      adapterName: 'figma',
      retryAfterTimestamp,
      rateLimitType: limitType,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: adapterState.adapterName,
      set: {
        retryAfterTimestamp,
        rateLimitType: limitType,
        updatedAt: new Date(),
      },
    });
}

/**
 * FigmaAdapter implements DesignSourceAdapter.
 * Fetches component images from the Figma REST API with:
 * - Persistent rate limit guard (PostgreSQL adapter_state table)
 * - S3 content-hash cache to avoid redundant API calls
 * - Batch processing (10 nodes per API call) with p-limit concurrency control
 *
 * Accepts optional dependency overrides for testing.
 */
export class FigmaAdapter implements DesignSourceAdapter {
  readonly name = 'figma';
  private readonly deps: FigmaAdapterDeps;

  constructor(deps: FigmaAdapterDeps) {
    this.deps = deps;
  }

  async load(config: FigmaAdapterConfig): Promise<DesignSpec> {
    const specs = await this.loadAll(config);
    return specs[0];
  }

  async loadAll(config: FigmaAdapterConfig): Promise<DesignSpec[]> {
    const checkRateLimit = this.deps.isRateLimitedFn ?? isRateLimited;
    const persistLimit = this.deps.persistRateLimitFn ?? persistRateLimit;

    // Check for active rate limit lockout BEFORE any API call
    const rateLimited = await checkRateLimit(config.dbConnectionString);
    if (rateLimited) {
      throw new Error(
        'Figma adapter is currently rate limited. Check adapter_state for retry_after_timestamp.',
      );
    }

    const { s3 } = this.deps;
    const limit = pLimit(3);

    // Split nodeIds into batches of 10
    const batches = chunkArray(config.nodeIds, 10);

    const allSpecs: DesignSpec[] = [];

    try {
      const batchResults = await Promise.all(
        batches.map((batch) =>
          limit(() => this.processBatch(batch, config, s3)),
        ),
      );

      for (const specs of batchResults) {
        allSpecs.push(...specs);
      }
    } catch (err) {
      if (err instanceof FigmaRateLimitError) {
        await persistLimit(
          config.dbConnectionString,
          err.retryAfterTimestamp,
          err.limitType,
        );
        throw err;
      }
      throw err;
    }

    return allSpecs;
  }

  private async processBatch(
    nodeIds: string[],
    config: FigmaAdapterConfig,
    s3: S3Client,
  ): Promise<DesignSpec[]> {
    // Fetch signed URLs from Figma API
    const response = await fetchFigmaImages(
      config.fileKey,
      nodeIds,
      config.accessToken,
    );

    const specs: DesignSpec[] = [];
    const capturedAt = new Date().toISOString();

    for (const nodeId of nodeIds) {
      const signedUrl = response.images[nodeId];
      if (!signedUrl) {
        continue;
      }

      // Download image bytes from signed URL (consuming before URL expires)
      const imageResponse = await fetch(signedUrl);
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to download Figma image for node ${nodeId}: ${imageResponse.status}`,
        );
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      const imageBytes = Buffer.from(arrayBuffer);

      // Compute content hash cache key
      const cacheKey = figmaCacheKey(imageBytes);

      // Check S3 cache — skip write if already present
      const hit = await checkCacheHit(s3, config.cacheBucket, cacheKey);
      let finalBytes: Buffer;

      if (hit) {
        // Use cached bytes
        finalBytes = await readFromCache(s3, config.cacheBucket, cacheKey);
      } else {
        // Store in S3 cache for future runs
        await writeToCache(s3, config.cacheBucket, cacheKey, imageBytes);
        finalBytes = imageBytes;
      }

      specs.push({
        sourceType: 'figma',
        referenceImage: finalBytes,
        metadata: {
          figmaNodeId: nodeId,
          capturedAt,
        },
      });
    }

    return specs;
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
