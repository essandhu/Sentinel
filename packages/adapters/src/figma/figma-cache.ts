import { createHash } from 'node:crypto';
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

/**
 * Computes a content-addressable S3 cache key for a Figma image.
 * Uses SHA-256 hash of image bytes to deduplicate unchanged images.
 */
export function figmaCacheKey(imageBytes: Buffer): string {
  const hash = createHash('sha256').update(imageBytes).digest('hex');
  return `figma-cache/${hash}.png`;
}

/**
 * Checks whether the object exists in S3 via a HEAD request.
 * Returns false on any error (treat as cache miss).
 */
export async function checkCacheHit(
  s3: S3Client,
  bucket: string,
  key: string,
): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Downloads an object from S3 cache and returns it as a Buffer.
 */
export async function readFromCache(
  s3: S3Client,
  bucket: string,
  key: string,
): Promise<Buffer> {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  if (!response.Body) {
    throw new Error(`No body in S3 response for key: ${key}`);
  }

  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  return Buffer.concat(chunks);
}

/**
 * Uploads image bytes to S3 cache with content-type image/png.
 */
export async function writeToCache(
  s3: S3Client,
  bucket: string,
  key: string,
  imageBytes: Buffer,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: imageBytes,
      ContentType: 'image/png',
    }),
  );
}
