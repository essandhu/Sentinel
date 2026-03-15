import Fastify from 'fastify';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LocalRuntime } from './local-runtime.js';
import type { WebSocket } from 'ws';

const activeSockets = new Set<WebSocket>();

export function broadcastProgress(event: Record<string, unknown>): void {
  const msg = JSON.stringify(event);
  for (const socket of activeSockets) {
    if (socket.readyState === 1) {
      // WebSocket.OPEN
      socket.send(msg);
    }
  }
}

export async function startDashboardServer(
  runtime: LocalRuntime,
  port: number = 5678,
): Promise<{ url: string; close: () => Promise<void> }> {
  const app = Fastify({ logger: false });

  // CORS for local development -- register before other hooks
  app.addHook('onRequest', (req, reply, done) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      reply.status(204).send();
      return;
    }
    done();
  });

  // WebSocket support
  const fastifyWebsocket = (await import('@fastify/websocket')).default;
  await app.register(fastifyWebsocket);

  // tRPC via Fastify adapter
  const { fastifyTRPCPlugin } = await import(
    '@trpc/server/adapters/fastify'
  );
  const { localRouter } = await import('./local-router.js');
  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: localRouter,
      createContext: () => ({ db: runtime.db }),
    },
  });

  // Static dashboard assets (bundled at publish time)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const dashboardDist = join(__dirname, '..', 'dashboard-dist');

  let hasStaticAssets = false;
  try {
    const fastifyStatic = (await import('@fastify/static')).default;
    await app.register(fastifyStatic, {
      root: dashboardDist,
      prefix: '/',
      wildcard: false,
    });
    hasStaticAssets = true;
  } catch {
    // dashboard-dist may not exist in development
    console.warn(
      'Dashboard assets not found. Run from published package or build dashboard first.',
    );
  }

  // Image serving from filesystem storage
  app.get('/images/*', async (req, reply) => {
    const key = (req.params as Record<string, string>)['*'];
    try {
      const buffer = await runtime.storage.download(key);
      reply.type('image/png').send(buffer);
    } catch {
      reply.status(404).send({ error: 'Image not found' });
    }
  });

  // Health endpoint
  app.get('/health', async () => ({ status: 'ok', mode: 'local' }));

  // WebSocket for live capture progress
  app.get('/ws', { websocket: true }, (socket) => {
    activeSockets.add(socket as unknown as WebSocket);
    socket.on('close', () =>
      activeSockets.delete(socket as unknown as WebSocket),
    );
  });

  // SPA fallback
  app.setNotFoundHandler(async (req, reply) => {
    if (
      req.method === 'GET' &&
      !req.url.startsWith('/trpc') &&
      !req.url.startsWith('/images') &&
      !req.url.startsWith('/ws')
    ) {
      if (hasStaticAssets) {
        try {
          return reply.sendFile('index.html');
        } catch {
          // fall through
        }
      }
      reply.status(404).send({ error: 'Dashboard not found' });
      return;
    }
    reply.status(404).send({ error: 'Not found' });
  });

  await app.listen({ port, host: '127.0.0.1' });

  const url = `http://localhost:${port}`;
  return {
    url,
    close: () => app.close(),
  };
}
