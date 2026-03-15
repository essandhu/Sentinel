import type { S3Client } from '@aws-sdk/client-s3';
import { extractDesignTokens } from '@sentinel/adapters';
import { createDb, workspaceSettings } from '@sentinel/db';
import { uploadBuffer } from '@sentinel/storage';
import { eq } from 'drizzle-orm';
import { decrypt } from '../services/crypto.js';

export interface FigmaResyncJobData {
  fileKey: string;
  workspaceId: string;
}

export interface FigmaResyncDeps {
  db: ReturnType<typeof createDb>;
  storageClient: S3Client;
  bucket: string;
}

/**
 * Processes a figma-resync BullMQ job:
 * 1. Looks up workspace settings for Figma credentials
 * 2. Decrypts the stored Figma access token
 * 3. Extracts design tokens from the Figma file
 * 4. Uploads the token JSON to S3 as a baseline artifact
 */
export async function processFigmaResyncJob(
  data: FigmaResyncJobData,
  deps: FigmaResyncDeps,
): Promise<void> {
  const { fileKey, workspaceId } = data;
  const { db, storageClient, bucket } = deps;

  // 1. Look up workspace settings
  const rows = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId));

  if (rows.length === 0) {
    throw new Error(`No workspace settings found for workspaceId: ${workspaceId}`);
  }

  const row = rows[0];

  // 2. Decrypt the Figma access token
  if (!row.figmaAccessToken) {
    throw new Error(`No Figma access token for workspaceId: ${workspaceId}`);
  }

  const accessToken = decrypt(row.figmaAccessToken);

  // 3. Extract design tokens from Figma
  const tokens = await extractDesignTokens(fileKey, accessToken);

  // 4. Upload token JSON to S3
  const s3Key = `baselines/figma-tokens/${workspaceId}/${fileKey}.json`;
  await uploadBuffer(
    storageClient,
    bucket,
    s3Key,
    Buffer.from(JSON.stringify(tokens)),
    'application/json',
  );

  console.log(
    `[figma-resync] Stored ${Object.keys(tokens).length} design tokens for workspace=${workspaceId} file=${fileKey} at ${s3Key}`,
  );
}
