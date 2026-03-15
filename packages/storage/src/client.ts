import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

export interface StorageClientConfig {
  endpoint?: string;
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

/**
 * Creates an S3Client configured for AWS S3 or MinIO.
 * CRITICAL: forcePathStyle must be true when endpoint is provided (e.g. MinIO).
 * Without forcePathStyle, requests route to virtual-hosted style URLs that MinIO does not support.
 */
export function createStorageClient(config: StorageClientConfig): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: config.credentials,
    // forcePathStyle is required for MinIO and other S3-compatible services
    forcePathStyle: !!config.endpoint,
  });
}

/**
 * Uploads a Buffer to S3/MinIO.
 */
export async function uploadBuffer(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * Downloads an object from S3/MinIO and returns it as a Buffer.
 */
export async function downloadBuffer(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<Buffer> {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`No body in response for key: ${key}`);
  }

  // response.Body is a Readable stream (in Node.js)
  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  return Buffer.concat(chunks);
}
