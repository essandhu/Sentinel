import mercurius from 'mercurius';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createDb } from '@sentinel-vrt/db';
import { schema } from './schema.js';
import { resolvers } from './resolvers.js';
import { loaders } from './loaders.js';

/**
 * Register the Mercurius GraphQL plugin on the Fastify instance.
 * Provides /graphql endpoint with:
 *   - API key auth (falls back to Clerk session auth)
 *   - Query depth limited to 7
 *   - GraphiQL playground in development mode
 *   - Batched loaders for N+1 prevention
 */
export async function registerGraphQL(app: FastifyInstance) {
  await app.register(mercurius as any, {
    schema,
    resolvers,
    loaders,
    queryDepth: 7,
    graphiql: process.env.NODE_ENV === 'development',
    path: '/graphql',
    context: async (req: FastifyRequest) => {
      const workspaceId = (req as any).workspaceId as string;
      const db = createDb(process.env.DATABASE_URL!);
      return { db, workspaceId };
    },
  });

  // Add auth preHandler for /graphql route
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.url.startsWith('/graphql')) return;

    // Try API key auth first
    const { authenticateApiKey } = await import('../routes/v1/auth.js');

    // Save original reply.send to detect if auth sent a response
    let authFailed = false;
    const originalCode = reply.code.bind(reply);
    const codeSpy = (statusCode: number) => {
      if (statusCode === 401) authFailed = true;
      return originalCode(statusCode);
    };

    // Temporarily intercept to detect API key auth failure
    const hasApiKey =
      req.headers['x-api-key'] ||
      (typeof req.headers.authorization === 'string' &&
        req.headers.authorization.match(/^Bearer\s+/i));

    if (hasApiKey) {
      await authenticateApiKey(req, reply);
      if ((req as any).workspaceId) return; // API key auth succeeded
    }

    // Fall back to Clerk session auth if available
    if (process.env.CLERK_SECRET_KEY) {
      try {
        const { getAuth } = await import('@clerk/fastify');
        const auth = getAuth(req);
        if (auth?.userId && auth?.orgId) {
          (req as any).workspaceId = auth.orgId;
          (req as any).userId = auth.userId;
          return;
        }
      } catch {
        // Clerk not available or auth failed
      }
    }

    // Neither auth method succeeded
    if (!(req as any).workspaceId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
  });
}
