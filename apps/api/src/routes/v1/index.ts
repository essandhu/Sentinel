import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rateLimit from '@fastify/rate-limit';
import { Redis } from 'ioredis';
import { authenticateApiKey } from './auth.js';
import { registerProjectRoutes } from './projects.js';
import { registerCaptureRoutes } from './captures.js';
import { registerDiffRoutes } from './diffs.js';
import { registerComponentRoutes } from './components.js';
import { registerHealthScoreRoutes } from './health-scores.js';
import { registerApprovalRoutes } from './approvals.js';
import { registerCaptureTriggerRoutes } from './captures-trigger.js';

/**
 * Encapsulated Fastify plugin for the REST API v1.
 * Registers auth hook, rate limiting, and OpenAPI/Swagger docs.
 * All routes within inherit /api/v1 prefix from server.ts registration.
 */
export async function v1RestApi(app: FastifyInstance): Promise<void> {
  // Register rate limiter with Redis store
  const redisUrl = process.env.REDIS_URL;
  await app.register(rateLimit, {
    max: parseInt(process.env.API_RATE_LIMIT_MAX || '100', 10),
    timeWindow: '1 minute',
    ...(redisUrl
      ? { redis: new Redis(redisUrl) }
      : {}),
    keyGenerator: (req) => (req as any).apiKeyHash || req.ip,
    global: true,
  });

  // Register OpenAPI spec generation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Sentinel API',
        version: '1.0.0',
        description: 'Public REST API for Sentinel design-to-code monitoring',
      },
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
          bearer: {
            type: 'http',
            scheme: 'bearer',
          },
        },
      },
      security: [{ apiKey: [] }, { bearer: [] }],
    },
  });

  // Register Swagger UI at /docs (becomes /api/v1/docs via prefix)
  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Auth hook for all routes (skips /docs internally)
  app.addHook('onRequest', authenticateApiKey);

  // Placeholder root route for health/version check
  app.get('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    return { name: 'Sentinel API', version: '1.0.0' };
  });

  // Register resource endpoint routes
  registerProjectRoutes(app);
  registerCaptureRoutes(app);
  registerDiffRoutes(app);
  registerComponentRoutes(app);
  registerHealthScoreRoutes(app);
  registerApprovalRoutes(app);
  registerCaptureTriggerRoutes(app);
}
