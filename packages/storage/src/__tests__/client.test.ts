import { describe, it, expect, vi, beforeEach } from 'vitest';

let s3ClientConstructorArgs: any[] = [];

// Mock the AWS SDK before importing the module under test
vi.mock('@aws-sdk/client-s3', () => {
  const mockSend = vi.fn();

  return {
    S3Client: class MockS3Client {
      send = mockSend;
      constructor(config: any) {
        s3ClientConstructorArgs.push(config);
      }
    },
    PutObjectCommand: class MockPutObjectCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
    GetObjectCommand: class MockGetObjectCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  };
});

import { S3Client } from '@aws-sdk/client-s3';
import { createStorageClient, uploadBuffer, downloadBuffer } from '../client.js';
import type { StorageClientConfig } from '../client.js';
import { Readable } from 'node:stream';

describe('createStorageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s3ClientConstructorArgs = [];
  });

  const baseConfig: StorageClientConfig = {
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    },
  };

  it('creates an S3Client with the given region and credentials', () => {
    createStorageClient(baseConfig);

    expect(s3ClientConstructorArgs).toHaveLength(1);
    expect(s3ClientConstructorArgs[0]).toEqual({
      endpoint: undefined,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      },
      forcePathStyle: false,
    });
  });

  it('sets forcePathStyle to true when an endpoint is provided (MinIO)', () => {
    const config: StorageClientConfig = {
      ...baseConfig,
      endpoint: 'http://localhost:9000',
    };

    createStorageClient(config);

    expect(s3ClientConstructorArgs[0]).toEqual(
      expect.objectContaining({
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
      }),
    );
  });

  it('sets forcePathStyle to false when no endpoint is provided (AWS S3)', () => {
    createStorageClient(baseConfig);

    expect(s3ClientConstructorArgs[0]).toEqual(
      expect.objectContaining({
        forcePathStyle: false,
      }),
    );
  });

  it('returns an S3Client instance', () => {
    const client = createStorageClient(baseConfig);
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(S3Client);
  });

  it('passes through custom endpoint URL', () => {
    const config: StorageClientConfig = {
      ...baseConfig,
      endpoint: 'https://s3.custom-domain.com',
    };

    createStorageClient(config);

    expect(s3ClientConstructorArgs[0].endpoint).toBe(
      'https://s3.custom-domain.com',
    );
  });
});

describe('uploadBuffer', () => {
  let mockClient: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = { send: vi.fn().mockResolvedValue({}) };
  });

  it('sends a PutObjectCommand with the correct parameters', async () => {
    const buf = Buffer.from('test image data');

    await uploadBuffer(
      mockClient as unknown as S3Client,
      'my-bucket',
      'images/test.png',
      buf,
      'image/png',
    );

    expect(mockClient.send).toHaveBeenCalledTimes(1);
    const command = mockClient.send.mock.calls[0][0];
    expect(command.input).toEqual({
      Bucket: 'my-bucket',
      Key: 'images/test.png',
      Body: buf,
      ContentType: 'image/png',
    });
  });

  it('propagates S3 errors', async () => {
    mockClient.send.mockRejectedValue(new Error('Access Denied'));

    await expect(
      uploadBuffer(
        mockClient as unknown as S3Client,
        'bucket',
        'key',
        Buffer.from('data'),
        'image/png',
      ),
    ).rejects.toThrow('Access Denied');
  });

  it('resolves successfully on upload', async () => {
    mockClient.send.mockResolvedValue({});

    await expect(
      uploadBuffer(
        mockClient as unknown as S3Client,
        'bucket',
        'key',
        Buffer.from('data'),
        'application/octet-stream',
      ),
    ).resolves.toBeUndefined();
  });
});

describe('downloadBuffer', () => {
  let mockClient: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = { send: vi.fn() };
  });

  it('sends a GetObjectCommand and returns the buffer from stream', async () => {
    const content = Buffer.from('hello world');
    const stream = Readable.from([content]);

    mockClient.send.mockResolvedValue({ Body: stream });

    const result = await downloadBuffer(
      mockClient as unknown as S3Client,
      'my-bucket',
      'images/test.png',
    );

    expect(mockClient.send).toHaveBeenCalledTimes(1);
    const command = mockClient.send.mock.calls[0][0];
    expect(command.input).toEqual({
      Bucket: 'my-bucket',
      Key: 'images/test.png',
    });
    expect(result).toEqual(content);
  });

  it('concatenates multiple chunks from the stream', async () => {
    const chunk1 = Buffer.from('hello ');
    const chunk2 = Buffer.from('world');
    const stream = Readable.from([chunk1, chunk2]);

    mockClient.send.mockResolvedValue({ Body: stream });

    const result = await downloadBuffer(
      mockClient as unknown as S3Client,
      'bucket',
      'key',
    );

    expect(result).toEqual(Buffer.from('hello world'));
  });

  it('throws when response body is missing', async () => {
    mockClient.send.mockResolvedValue({ Body: undefined });

    await expect(
      downloadBuffer(mockClient as unknown as S3Client, 'bucket', 'my-key'),
    ).rejects.toThrow('No body in response for key: my-key');
  });

  it('throws when response body is null', async () => {
    mockClient.send.mockResolvedValue({ Body: null });

    await expect(
      downloadBuffer(mockClient as unknown as S3Client, 'bucket', 'my-key'),
    ).rejects.toThrow('No body in response for key: my-key');
  });

  it('propagates stream errors', async () => {
    const stream = new Readable({
      read() {
        this.destroy(new Error('Stream failure'));
      },
    });

    mockClient.send.mockResolvedValue({ Body: stream });

    await expect(
      downloadBuffer(mockClient as unknown as S3Client, 'bucket', 'key'),
    ).rejects.toThrow('Stream failure');
  });

  it('propagates S3 client errors', async () => {
    mockClient.send.mockRejectedValue(new Error('NoSuchKey'));

    await expect(
      downloadBuffer(mockClient as unknown as S3Client, 'bucket', 'key'),
    ).rejects.toThrow('NoSuchKey');
  });
});
