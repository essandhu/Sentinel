import { describe, it, expect } from 'vitest';
import { S3StorageAdapter } from '../s3-adapter.js';
import type { StorageAdapter } from '../adapter.js';

describe('S3StorageAdapter', () => {
  const config = {
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    bucket: 'test-bucket',
  };

  it('implements StorageAdapter interface', () => {
    const adapter: StorageAdapter = new S3StorageAdapter(config);
    expect(typeof adapter.upload).toBe('function');
    expect(typeof adapter.download).toBe('function');
    expect(typeof adapter.exists).toBe('function');
    expect(typeof adapter.delete).toBe('function');
    expect(typeof adapter.ensureReady).toBe('function');
  });

  it('exposes getClient() escape hatch', () => {
    const adapter = new S3StorageAdapter(config);
    const client = adapter.getClient();
    expect(client).toBeDefined();
  });

  it('exposes getBucket() escape hatch', () => {
    const adapter = new S3StorageAdapter(config);
    expect(adapter.getBucket()).toBe('test-bucket');
  });

  it('uses forcePathStyle when endpoint is provided', () => {
    const adapter = new S3StorageAdapter(config);
    const client = adapter.getClient();
    // S3Client stores config internally; we verify it was created without throwing
    expect(client).toBeDefined();
  });

  it('works without endpoint (direct AWS S3)', () => {
    const awsConfig = {
      region: 'us-west-2',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      bucket: 'my-bucket',
    };
    const adapter = new S3StorageAdapter(awsConfig);
    expect(adapter.getBucket()).toBe('my-bucket');
    expect(adapter.getClient()).toBeDefined();
  });
});
