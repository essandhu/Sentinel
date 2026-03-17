import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { createStorageClient, uploadBuffer, downloadBuffer } from '../src/client.js';
import { StorageKeys } from '../src/paths.js';
import { ensureBucket } from '../src/init.js';
import type { S3Client } from '@aws-sdk/client-s3';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const S3_REGION = process.env.S3_REGION ?? 'us-east-1';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? 'minioadmin';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? 'minioadmin';
const TEST_BUCKET = 'sentinel-test';

// Check actual S3/MinIO connectivity
async function isS3Available(): Promise<boolean> {
  try {
    const response = await fetch(S3_ENDPOINT, { signal: AbortSignal.timeout(3000) });
    return response.status > 0;
  } catch {
    return false;
  }
}

let client: S3Client;
const uploadedKeys: string[] = [];

// Minimal 1x1 red pixel PNG (binary representation)
const RED_PIXEL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length + type
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width: 1, height: 1
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color type, etc.
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, // IDAT data (1x1 red pixel)
  0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND chunk
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

describe('@sentinel-vrt/storage integration', async () => {
  const available = await isS3Available();
  if (!available) {
    it.skip('S3/MinIO not available -- skipping storage tests', () => {});
    return;
  }

  beforeAll(async () => {
    client = createStorageClient({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
    });
    await ensureBucket(client, TEST_BUCKET);
  });

  afterAll(async () => {
    // Clean up uploaded objects
    for (const key of uploadedKeys) {
      await client.send(
        new DeleteObjectCommand({ Bucket: TEST_BUCKET, Key: key }),
      );
    }
  });
  it('ensureBucket creates the bucket if it does not exist', async () => {
    // Already called in beforeAll, just verify no error was thrown
    // Call again to test idempotency
    await expect(ensureBucket(client, TEST_BUCKET)).resolves.not.toThrow();
  });

  it('ensureBucket is idempotent (calling twice does not throw)', async () => {
    await expect(ensureBucket(client, TEST_BUCKET)).resolves.not.toThrow();
    await expect(ensureBucket(client, TEST_BUCKET)).resolves.not.toThrow();
  });

  it('uploadBuffer stores a buffer and downloadBuffer retrieves it identically', async () => {
    const key = StorageKeys.capture('test-run-id', 'test-snapshot-id');
    uploadedKeys.push(key);

    await uploadBuffer(client, TEST_BUCKET, key, RED_PIXEL_PNG, 'image/png');
    const downloaded = await downloadBuffer(client, TEST_BUCKET, key);

    expect(downloaded.equals(RED_PIXEL_PNG)).toBe(true);
  });

  it('StorageKeys.capture generates deterministic path format', () => {
    const key = StorageKeys.capture('run-123', 'snap-456');
    expect(key).toBe('captures/run-123/snap-456/captured.png');
  });

  it('StorageKeys.baseline generates correct path format', () => {
    const key = StorageKeys.baseline('proj-123', 'snap-456');
    expect(key).toBe('baselines/proj-123/snap-456/baseline.png');
  });

  it('StorageKeys.diff generates correct path format', () => {
    const key = StorageKeys.diff('run-123', 'snap-456');
    expect(key).toBe('diffs/run-123/snap-456/diff.png');
  });

  it('StorageKeys.thumbnail generates correct path format', () => {
    const key = StorageKeys.thumbnail('run-123', 'snap-456');
    expect(key).toBe('thumbnails/run-123/snap-456/thumb.png');
  });
});
