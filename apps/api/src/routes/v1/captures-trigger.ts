import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createDb, projects, captureRuns } from '@sentinel-vrt/db';
import { getCaptureQueue } from '../../queue.js';

const db = createDb(process.env.DATABASE_URL!);

const captureTriggerSchema = {
  tags: ['Captures'],
  summary: 'Trigger a new capture run',
  body: {
    type: 'object' as const,
    properties: {
      projectId: { type: 'string' as const, format: 'uuid' },
      configPath: { type: 'string' as const },
      config: { type: 'object' as const, additionalProperties: true },
      branchName: { type: 'string' as const },
      commitSha: { type: 'string' as const },
      shardCount: { type: 'integer' as const, minimum: 1, maximum: 50 },
    },
    required: ['projectId'] as const,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        runId: { type: 'string', format: 'uuid' },
        jobId: { type: 'string' },
      },
    },
    400: {
      type: 'object',
      properties: { error: { type: 'string' } },
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

export function registerCaptureTriggerRoutes(app: FastifyInstance): void {
  app.post('/captures/run', { schema: captureTriggerSchema }, async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = (req as any).workspaceId;
    const { projectId, configPath, config, branchName, commitSha, shardCount } = req.body as {
      projectId: string;
      configPath?: string;
      config?: Record<string, unknown>;
      branchName?: string;
      commitSha?: string;
      shardCount?: number;
    };

    if (!configPath && !config) {
      return reply.code(400).send({ error: 'Either configPath or config must be provided' });
    }

    // Verify project belongs to workspace
    const projectRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)));

    if (projectRows.length === 0) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    const runId = randomUUID();

    // Insert capture run record
    await db.insert(captureRuns).values({
      id: runId,
      projectId,
      branchName: branchName ?? null,
      commitSha: commitSha ?? null,
      status: 'pending',
    });

    // Enqueue BullMQ capture-plan job (worker will compute shard plan and fan out)
    const queue = getCaptureQueue();
    const job = await queue.add('capture-plan', {
      captureRunId: runId,
      ...(configPath ? { configPath } : {}),
      ...(config ? { config } : {}),
      projectId,
      ...(shardCount != null ? { shardCount } : {}),
    });

    return { runId, jobId: job.id };
  });
}
