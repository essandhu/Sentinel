import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';

/**
 * Ensures a storage bucket exists, creating it if it does not.
 * Idempotent: safe to call multiple times.
 *
 * @param client - S3Client instance
 * @param bucket - Bucket name to ensure exists
 */
export async function ensureBucket(
  client: S3Client,
  bucket: string,
): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    // Bucket already exists — nothing to do
  } catch (error) {
    if (
      error instanceof S3ServiceException &&
      (error.$response?.statusCode === 404 ||
        error.name === 'NotFound' ||
        error.name === 'NoSuchBucket')
    ) {
      // Bucket does not exist — create it
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    } else {
      // Re-throw unexpected errors
      throw error;
    }
  }
}
