import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { createDb, projects } from '@sentinel-vrt/db';
import { listComponents } from '../../services/component-service.js';

const db = createDb(process.env.DATABASE_URL!);

const componentsListSchema = {
  tags: ['Components'],
  summary: 'List components for a project',
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
          name: { type: 'string' },
          selector: { type: 'string' },
          description: { type: ['string', 'null'] },
          enabled: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
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

export function registerComponentRoutes(app: FastifyInstance): void {
  app.get('/projects/:projectId/components', { schema: componentsListSchema }, async (req: FastifyRequest, reply: FastifyReply) => {
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

    return listComponents(db, projectId);
  });
}
