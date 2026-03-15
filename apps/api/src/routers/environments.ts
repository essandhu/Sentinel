import { z } from 'zod';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb } from '@sentinel/db';
import {
  listEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
} from '../services/environment-service.js';
import {
  computeEnvironmentDiff,
  listEnvironmentRoutes,
} from '../services/environment-diff.js';
import type { StorageAdapter } from '../services/environment-diff.js';
import { downloadBuffer, uploadBuffer } from '@sentinel/storage';
import { createStorageClient } from '@sentinel/storage';

function getDb() {
  return createDb(process.env.DATABASE_URL!);
}

function getStorageAdapter(): StorageAdapter {
  const client = createStorageClient({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
  });
  return {
    download: (bucket, key) => downloadBuffer(client, bucket, key),
    upload: (bucket, key, body, contentType) => uploadBuffer(client, bucket, key, body, contentType),
  };
}

function getBucket(): string {
  return process.env.S3_BUCKET ?? 'sentinel';
}

export const environmentsRouter = t.router({
  /**
   * List all environments for a project.
   */
  list: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return listEnvironments(getDb(), input.projectId);
    }),

  /**
   * Create a new environment for a project.
   */
  create: workspaceProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
      baseUrl: z.string().url().optional(),
      isReference: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      return createEnvironment(getDb(), input);
    }),

  /**
   * Update an environment's baseUrl and/or isReference flag.
   */
  update: workspaceProcedure
    .input(z.object({
      id: z.string().uuid(),
      baseUrl: z.string().url().nullish(),
      isReference: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      return updateEnvironment(getDb(), input);
    }),

  /**
   * Delete an environment.
   */
  delete: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return deleteEnvironment(getDb(), input.id);
    }),

  /**
   * Compare two environments for a specific route.
   * Returns cached result when both snapshots are unchanged.
   */
  compareDiff: workspaceProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      sourceEnv: z.string(),
      targetEnv: z.string(),
      url: z.string(),
      viewport: z.string(),
      browser: z.string().default('chromium'),
    }))
    .query(async ({ input }) => {
      return computeEnvironmentDiff(
        getDb(),
        getStorageAdapter(),
        getBucket(),
        input,
      );
    }),

  /**
   * List distinct routes available for an environment.
   */
  listRoutes: workspaceProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      environmentName: z.string(),
    }))
    .query(async ({ input }) => {
      return listEnvironmentRoutes(getDb(), input.projectId, input.environmentName);
    }),
});
