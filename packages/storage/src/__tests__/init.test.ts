import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AWS SDK before importing the module under test
vi.mock('@aws-sdk/client-s3', () => {
  class MockS3Client {
    send = vi.fn();
    constructor(public config?: any) {}
  }

  class MockHeadBucketCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }

  class MockCreateBucketCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }

  class MockS3ServiceException extends Error {
    $response?: { statusCode: number };
    constructor(
      message: string,
      opts: { name: string; $response?: { statusCode: number } },
    ) {
      super(message);
      this.name = opts.name;
      this.$response = opts.$response;
    }
  }

  return {
    S3Client: MockS3Client,
    HeadBucketCommand: MockHeadBucketCommand,
    CreateBucketCommand: MockCreateBucketCommand,
    S3ServiceException: MockS3ServiceException,
  };
});

import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { ensureBucket } from '../init.js';

describe('ensureBucket', () => {
  let mockClient: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = { send: vi.fn() };
  });

  it('does nothing when the bucket already exists (HeadBucket succeeds)', async () => {
    mockClient.send.mockResolvedValue({});

    await ensureBucket(mockClient as unknown as S3Client, 'existing-bucket');

    // Only HeadBucket should be sent, not CreateBucket
    expect(mockClient.send).toHaveBeenCalledTimes(1);
    const command = mockClient.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(HeadBucketCommand);
    expect(command.input).toEqual({ Bucket: 'existing-bucket' });
  });

  it('creates the bucket when HeadBucket returns 404', async () => {
    const notFoundError = new (S3ServiceException as any)('not found', {
      name: 'NotFound',
      $response: { statusCode: 404 },
    });

    mockClient.send
      .mockRejectedValueOnce(notFoundError)
      .mockResolvedValueOnce({});

    await ensureBucket(mockClient as unknown as S3Client, 'new-bucket');

    expect(mockClient.send).toHaveBeenCalledTimes(2);
    const headCmd = mockClient.send.mock.calls[0][0];
    expect(headCmd).toBeInstanceOf(HeadBucketCommand);
    expect(headCmd.input).toEqual({ Bucket: 'new-bucket' });

    const createCmd = mockClient.send.mock.calls[1][0];
    expect(createCmd).toBeInstanceOf(CreateBucketCommand);
    expect(createCmd.input).toEqual({ Bucket: 'new-bucket' });
  });

  it('creates the bucket when HeadBucket throws NotFound by name', async () => {
    const notFoundError = new (S3ServiceException as any)('not found', {
      name: 'NotFound',
    });

    mockClient.send
      .mockRejectedValueOnce(notFoundError)
      .mockResolvedValueOnce({});

    await ensureBucket(mockClient as unknown as S3Client, 'new-bucket');

    expect(mockClient.send).toHaveBeenCalledTimes(2);
    const createCmd = mockClient.send.mock.calls[1][0];
    expect(createCmd).toBeInstanceOf(CreateBucketCommand);
  });

  it('creates the bucket when HeadBucket throws NoSuchBucket', async () => {
    const noSuchBucketError = new (S3ServiceException as any)(
      'no such bucket',
      { name: 'NoSuchBucket' },
    );

    mockClient.send
      .mockRejectedValueOnce(noSuchBucketError)
      .mockResolvedValueOnce({});

    await ensureBucket(mockClient as unknown as S3Client, 'missing-bucket');

    expect(mockClient.send).toHaveBeenCalledTimes(2);
    const createCmd = mockClient.send.mock.calls[1][0];
    expect(createCmd).toBeInstanceOf(CreateBucketCommand);
    expect(createCmd.input).toEqual({ Bucket: 'missing-bucket' });
  });

  it('re-throws unexpected S3ServiceException errors (e.g. 403 Forbidden)', async () => {
    const forbiddenError = new (S3ServiceException as any)('forbidden', {
      name: 'Forbidden',
      $response: { statusCode: 403 },
    });

    mockClient.send.mockRejectedValue(forbiddenError);

    await expect(
      ensureBucket(mockClient as unknown as S3Client, 'forbidden-bucket'),
    ).rejects.toThrow('forbidden');

    // Only HeadBucket attempted, no CreateBucket
    expect(mockClient.send).toHaveBeenCalledTimes(1);
  });

  it('re-throws non-S3ServiceException errors (e.g. network failures)', async () => {
    const networkError = new Error('Network timeout');

    mockClient.send.mockRejectedValue(networkError);

    await expect(
      ensureBucket(mockClient as unknown as S3Client, 'bucket'),
    ).rejects.toThrow('Network timeout');

    expect(mockClient.send).toHaveBeenCalledTimes(1);
  });

  it('propagates errors from CreateBucketCommand', async () => {
    const notFoundError = new (S3ServiceException as any)('not found', {
      name: 'NotFound',
      $response: { statusCode: 404 },
    });

    const createError = new Error('BucketAlreadyOwnedByYou');

    mockClient.send
      .mockRejectedValueOnce(notFoundError)
      .mockRejectedValueOnce(createError);

    await expect(
      ensureBucket(mockClient as unknown as S3Client, 'race-bucket'),
    ).rejects.toThrow('BucketAlreadyOwnedByYou');
  });

  it('is idempotent — calling twice when bucket exists is safe', async () => {
    mockClient.send.mockResolvedValue({});

    await ensureBucket(mockClient as unknown as S3Client, 'my-bucket');
    await ensureBucket(mockClient as unknown as S3Client, 'my-bucket');

    // HeadBucket called twice, CreateBucket never called
    expect(mockClient.send).toHaveBeenCalledTimes(2);
    for (const call of mockClient.send.mock.calls) {
      expect(call[0]).toBeInstanceOf(HeadBucketCommand);
    }
  });
});
