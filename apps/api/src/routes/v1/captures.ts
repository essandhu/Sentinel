import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { createDb, projects } from '@sentinel/db';
import { listRunsByProject } from '../../services/run-service.js';
import { verifyRunInWorkspace } from '../../services/diff-service.js';

const db = createDb(process.env.DATABASE_URL!);

const capturesListSchema = {
  tags: ['Captures'],
  summary: 'List capture runs for a project',
  params: {
    type: 'object' as const,
    properties: {
      projectId: { type: 'string' as const, format: 'uuid' },
    },
    required: ['projectId'] as const,
  },
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          commitSha: { type: ['string', 'null'] },
          branchName: { type: ['string', 'null'] },
          status: { type: 'string' },
          source: { type: ['string', 'null'] },
          createdAt: { type: 'string', format: 'date-time' },
          completedAt: { type: ['string', 'null'], format: 'date-time' },
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

const captureGetSchema = {
  tags: ['Captures'],
  summary: 'Get a capture run by ID',
  params: {
    type: 'object' as const,
    properties: {
      runId: { type: 'string' as const, format: 'uuid' },
    },
    required: ['runId'] as const,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        projectId: { type: 'string', format: 'uuid' },
        commitSha: { type: ['string', 'null'] },
        branchName: { type: ['string', 'null'] },
        status: { type: 'string' },
        source: { type: ['string', 'null'] },
        createdAt: { type: 'string', format: 'date-time' },
        completedAt: { type: ['string', 'null'], format: 'date-time' },
      },
    },
    404: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
  },
};

export function registerCaptureRoutes(app: FastifyInstance): void {
  app.get('/captures/:runId', { schema: captureGetSchema }, async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = (req as any).workspaceId;
    const { runId } = req.params as { runId: string };

    const run = await verifyRunInWorkspace(db, runId, workspaceId);
    if (!run) {
      return reply.code(404).send({ error: 'Capture run not found' });
    }

    return run;
  });

  app.get('/projects/:projectId/captures', { schema: capturesListSchema }, async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = (req as any).workspaceId;
    const { projectId } = req.params as { projectId: string };

    // Verify project belongs to workspace
    const projectRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)));

    if (projectRows.length === 0) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    return listRunsByProject(db, projectId);
  });
}
