import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createDb } from '@sentinel-vrt/db';
import { getDiffsByRunId, verifyRunInWorkspace } from '../../services/diff-service.js';

const db = createDb(process.env.DATABASE_URL!);

const diffsListSchema = {
  tags: ['Diffs'],
  summary: 'List diff reports for a capture run',
  params: {
    type: 'object' as const,
    properties: {
      runId: { type: 'string' as const, format: 'uuid' },
    },
    required: ['runId'] as const,
  },
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          snapshotId: { type: 'string', format: 'uuid' },
          pixelDiffPercent: { type: ['integer', 'null'] },
          ssimScore: { type: ['integer', 'null'] },
          passed: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          snapshotUrl: { type: 'string' },
          snapshotViewport: { type: 'string' },
          browser: { type: 'string' },
        },
      },
    },
    401: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
    404: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
  },
};

export function registerDiffRoutes(app: FastifyInstance): void {
  app.get('/captures/:runId/diffs', { schema: diffsListSchema }, async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = (req as any).workspaceId;
    const { runId } = req.params as { runId: string };

    // Verify run belongs to workspace
    const run = await verifyRunInWorkspace(db, runId, workspaceId);

    if (!run) {
      return reply.code(404).send({ error: 'Capture run not found' });
    }

    // Query diffs with snapshot join for context
    const rows = await getDiffsByRunId(db, runId, workspaceId);

    // Flatten the result for API consumers
    return rows.map((row) => ({
      id: row.id,
      snapshotId: row.snapshotId,
      pixelDiffPercent: row.pixelDiffPercent,
      ssimScore: row.ssimScore,
      passed: row.passed,
      createdAt: row.createdAt,
      snapshotUrl: row.url,
      snapshotViewport: row.viewport,
      browser: row.browser,
    }));
  });
}
