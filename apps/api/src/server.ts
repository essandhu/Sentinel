import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createStorageClient } from '@sentinel/storage';
import { appRouter } from './routers/index.js';
import { createContext } from './context.js';
import { registerFigmaWebhookRoute } from './webhooks/figma-webhook-handler.js';
import { registerGithubMergeWebhookRoute } from './webhooks/github-merge-handler.js';
import { registerSketchUploadRoute } from './routes/sketch-upload.js';
import { v1RestApi } from './routes/v1/index.js';
import { registerGraphQL } from './graphql/index.js';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty' }
          : undefined,
    },
  });

  // Register CORS
  await app.register(cors);

  // Health check endpoint for container readiness (before auth/tRPC to avoid conflicts)
  app.get('/health', async (_req, reply) => {
    return reply.send({ status: 'ok' });
  });

  // Register Clerk auth plugin only when CLERK_SECRET_KEY is present
  if (process.env.CLERK_SECRET_KEY) {
    const { clerkPlugin } = await import('@clerk/fastify');
    await app.register(clerkPlugin);
    app.log.info('Clerk auth plugin registered');
  } else {
    app.log.warn('CLERK_SECRET_KEY not set — Clerk auth plugin skipped (not suitable for production)');
  }

  // Register @fastify/websocket for real-time push (before routes that use it)
  await app.register(websocket, { options: { maxPayload: 1_048_576 } });

  // Register WebSocket /ws route and start heartbeat
  const { registerWsRoute } = await import('./ws/websocket-route.js');
  registerWsRoute(app);
  const { wsManager } = await import('./ws/websocket-manager.js');
  wsManager.startHeartbeat();

  // Register @fastify/multipart for file uploads (before tRPC to avoid interference)
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  // Register Figma webhook route (raw body capture via encapsulated plugin)
  registerFigmaWebhookRoute(app);

  // Register GitHub merge webhook route (baseline promotion on PR merge)
  registerGithubMergeWebhookRoute(app);

  // Register Sketch upload route (uses multipart)
  registerSketchUploadRoute(app);

  // Register REST API v1 plugin (auth, rate limit, swagger)
  await app.register(v1RestApi, { prefix: '/api/v1' });

  // Register GraphQL endpoint at /graphql (Mercurius)
  await registerGraphQL(app);

  // Register tRPC router at /trpc prefix
  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
    },
  });

  // Presigned URL image route — returns 302 redirect to S3 presigned URL
  // Dashboard uses /images/${snapshotS3Key} to load captured screenshot images
  app.get('/images/*', {
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
    const key = (req.params as { '*': string })['*'];
    if (!key) return reply.status(400).send({ error: 'Missing image key' });

    const storageClient = createStorageClient({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
    });

    const url = await getSignedUrl(
      storageClient,
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
      { expiresIn: 3600 }
    );

    return reply.redirect(url, 302);
  });

  return app;
}
