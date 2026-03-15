import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { SketchAdapter } from '@sentinel/adapters';
import { createStorageClient } from '@sentinel/storage';
import { createDb } from '@sentinel/db';
import { writeDesignBaselines } from '../services/baseline-writer.js';

/**
 * Registers the POST /api/sketch/upload raw Fastify route.
 *
 * Accepts a multipart .sketch file upload + projectId field.
 * Extracts artboard metadata via SketchAdapter, persists baselines.
 */
export function registerSketchUploadRoute(app: FastifyInstance) {
  app.post('/api/sketch/upload', {
    preHandler: async (req, reply) => {
      if (process.env.CLERK_SECRET_KEY) {
        const { getAuth } = await import('@clerk/fastify');
        const { userId } = getAuth(req);
        if (!userId) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
      }
    },
  }, async (req, reply) => {
    let tempPath: string | undefined;

    try {
      const parts = req.parts();
      let fileBuffer: Buffer | undefined;
      let fileName: string | undefined;
      let projectId: string | undefined;

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'file') {
          fileBuffer = await part.toBuffer();
          fileName = part.filename;
        } else if (part.type === 'field' && part.fieldname === 'projectId') {
          projectId = part.value as string;
        }
      }

      if (!fileBuffer || !fileName) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      if (!projectId) {
        return reply.code(400).send({ error: 'Missing projectId field' });
      }

      // Write to temp file for SketchAdapter
      tempPath = join(tmpdir(), `${randomUUID()}.sketch`);
      await writeFile(tempPath, fileBuffer);

      // Extract artboards via SketchAdapter
      const adapter = new SketchAdapter();
      const specs = await adapter.loadAll({ filePath: tempPath });

      // Persist baselines
      const storageClient = createStorageClient({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION ?? 'us-east-1',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY ?? '',
          secretAccessKey: process.env.S3_SECRET_KEY ?? '',
        },
      });

      const db = createDb();
      const bucket = process.env.S3_BUCKET ?? 'sentinel';

      // Get userId from auth context
      let userId = 'anonymous';
      if (process.env.CLERK_SECRET_KEY) {
        const { getAuth } = await import('@clerk/fastify');
        const { userId: authUserId } = getAuth(req);
        if (authUserId) userId = authUserId;
      }

      const result = await writeDesignBaselines(
        specs,
        projectId,
        userId,
        storageClient,
        bucket,
        db,
      );

      return reply.send({
        success: true,
        artboards: specs.map((s) => ({
          name: s.metadata.componentName,
          artboardId: s.metadata.sketchArtboardId,
        })),
        baselineCount: result.baselineCount,
      });
    } finally {
      // Clean up temp file
      if (tempPath) {
        await unlink(tempPath).catch(() => {});
      }
    }
  });
}
