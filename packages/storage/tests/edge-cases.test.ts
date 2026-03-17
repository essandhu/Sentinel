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
const TEST_BUCKET = 'sentinel-edge-test';

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

describe('@sentinel-vrt/storage edge cases', async () => {
  const available = await isS3Available();
  if (!available) {
    it.skip('S3/MinIO not available -- skipping edge-case tests', () => {});
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

  it('downloadBuffer throws for non-existent key', async () => {
    await expect(
      downloadBuffer(client, TEST_BUCKET, 'nonexistent/key/that/does/not/exist.png'),
    ).rejects.toThrow();
  });

  it('handles uploading an empty buffer', async () => {
    const key = 'edge-test/empty-buffer.bin';
    uploadedKeys.push(key);

    const emptyBuf = Buffer.alloc(0);
    await uploadBuffer(client, TEST_BUCKET, key, emptyBuf, 'application/octet-stream');
    const downloaded = await downloadBuffer(client, TEST_BUCKET, key);

    expect(downloaded.length).toBe(0);
  });

  it('handles uploading a large buffer (1MB)', async () => {
    const key = 'edge-test/large-buffer.bin';
    uploadedKeys.push(key);

    const largeBuf = Buffer.alloc(1024 * 1024, 0x42);
    await uploadBuffer(client, TEST_BUCKET, key, largeBuf, 'application/octet-stream');
    const downloaded = await downloadBuffer(client, TEST_BUCKET, key);

    expect(downloaded.length).toBe(1024 * 1024);
    expect(downloaded.equals(largeBuf)).toBe(true);
  });

  it('overwrites existing key without error', async () => {
    const key = 'edge-test/overwrite-test.txt';
    uploadedKeys.push(key);

    const v1 = Buffer.from('version-1');
    const v2 = Buffer.from('version-2');

    await uploadBuffer(client, TEST_BUCKET, key, v1, 'text/plain');
    await uploadBuffer(client, TEST_BUCKET, key, v2, 'text/plain');

    const downloaded = await downloadBuffer(client, TEST_BUCKET, key);
    expect(downloaded.toString()).toBe('version-2');
  });

  it('handles keys with special characters', async () => {
    const key = 'test/special chars/file (1).png';
    uploadedKeys.push(key);

    const buf = Buffer.from('special-chars-content');
    await uploadBuffer(client, TEST_BUCKET, key, buf, 'image/png');
    const downloaded = await downloadBuffer(client, TEST_BUCKET, key);

    expect(downloaded.equals(buf)).toBe(true);
  });

  it('handles deeply nested key paths', async () => {
    const key = 'a/b/c/d/e/f/g/h/deep-file.png';
    uploadedKeys.push(key);

    const buf = Buffer.from('deep-content');
    await uploadBuffer(client, TEST_BUCKET, key, buf, 'image/png');
    const downloaded = await downloadBuffer(client, TEST_BUCKET, key);

    expect(downloaded.equals(buf)).toBe(true);
  });
});

describe('StorageKeys path generation', () => {
  const testId1 = 'test-id-1';
  const testId2 = 'test-id-2';

  const keyGenerators = [
    { name: 'capture', fn: () => StorageKeys.capture(testId1, testId2) },
    { name: 'baseline', fn: () => StorageKeys.baseline(testId1, testId2) },
    { name: 'diff', fn: () => StorageKeys.diff(testId1, testId2) },
    { name: 'thumbnail', fn: () => StorageKeys.thumbnail(testId1, testId2) },
  ];

  it('all key generators produce non-empty strings without "undefined" or "null"', () => {
    for (const { name, fn } of keyGenerators) {
      const key = fn();
      expect(key.length, `${name} should produce a non-empty string`).toBeGreaterThan(0);
      expect(key, `${name} should not contain "undefined"`).not.toContain('undefined');
      expect(key, `${name} should not contain "null"`).not.toContain('null');
    }
  });

  it('key paths use forward slashes not backslashes', () => {
    for (const { name, fn } of keyGenerators) {
      const key = fn();
      expect(key, `${name} should not contain backslashes`).not.toContain('\\');
      expect(key, `${name} should contain forward slashes`).toContain('/');
    }
  });

  it('different key types produce different paths for same IDs', () => {
    const captureKey = StorageKeys.capture(testId1, testId2);
    const baselineKey = StorageKeys.baseline(testId1, testId2);
    const diffKey = StorageKeys.diff(testId1, testId2);
    const thumbnailKey = StorageKeys.thumbnail(testId1, testId2);

    const allKeys = [captureKey, baselineKey, diffKey, thumbnailKey];
    const uniqueKeys = new Set(allKeys);

    expect(uniqueKeys.size).toBe(4);
  });
});
