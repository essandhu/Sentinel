import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

import type { StorageAdapter } from './adapter.js';
import { ensureBucket } from './init.js';

export interface S3StorageAdapterConfig {
  endpoint?: string;
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  bucket: string;
}

/**
 * StorageAdapter implementation backed by S3 or any S3-compatible service
 * (e.g. MinIO). Wraps the existing S3 helper functions into the unified
 * StorageAdapter interface.
 */
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3StorageAdapterConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: config.credentials,
      forcePathStyle: !!config.endpoint,
    });
  }

  async upload(key: string, buffer: Buffer, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType ?? 'application/octet-stream',
      }),
    );
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`No body in response for key: ${key}`);
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

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async ensureReady(): Promise<void> {
    await ensureBucket(this.client, this.bucket);
  }

  /** Escape hatch: returns the underlying S3Client for backward compatibility. */
  getClient(): S3Client {
    return this.client;
  }

  /** Escape hatch: returns the configured bucket name. */
  getBucket(): string {
    return this.bucket;
  }
}
