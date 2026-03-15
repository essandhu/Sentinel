import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { createDb, projects } from '@sentinel/db';
import { listProjects, getProjectById } from '../../services/project-service.js';

const db = createDb(process.env.DATABASE_URL!);

const projectListSchema = {
  tags: ['Projects'],
  summary: 'List all projects in workspace',
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    401: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
  },
};

const projectByIdSchema = {
  tags: ['Projects'],
  summary: 'Get project by ID',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
    required: ['id'] as const,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
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

const projectCreateSchema = {
  tags: ['Projects'],
  summary: 'Create a project',
  body: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const, minLength: 1 },
    },
    required: ['name'] as const,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
    201: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
};

export function registerProjectRoutes(app: FastifyInstance): void {
  app.get('/projects', { schema: projectListSchema }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const workspaceId = (req as any).workspaceId;

    return listProjects(db, workspaceId);
  });

  app.get('/projects/:id', { schema: projectByIdSchema }, async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = (req as any).workspaceId;
    const { id } = req.params as { id: string };

    const project = await getProjectById(db, id, workspaceId);

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    return project;
  });

  app.post('/projects', { schema: projectCreateSchema }, async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = (req as any).workspaceId;
    const { name } = req.body as { name: string };

    // Upsert: return existing project if name matches in workspace
    const existing = await db.select().from(projects)
      .where(and(eq(projects.name, name), eq(projects.workspaceId, workspaceId)));

    if (existing.length > 0) {
      return existing[0];
    }

    const [created] = await db.insert(projects)
      .values({ name, workspaceId })
      .returning();

    return reply.code(201).send(created);
  });
}
