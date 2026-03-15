import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { createDb, projects } from '@sentinel/db';
import { listHealthScores } from '../../services/health-query-service.js';

const db = createDb(process.env.DATABASE_URL!);

const healthScoresListSchema = {
  tags: ['Health Scores'],
  summary: 'List health scores for a project',
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
          componentId: { type: ['string', 'null'], format: 'uuid' },
          score: { type: 'integer' },
          windowDays: { type: 'integer' },
          computedAt: { type: 'string', format: 'date-time' },
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

export function registerHealthScoreRoutes(app: FastifyInstance): void {
  app.get('/projects/:projectId/health-scores', { schema: healthScoresListSchema }, async (req: FastifyRequest, reply: FastifyReply) => {
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

    return listHealthScores(db, projectId);
  });
}
