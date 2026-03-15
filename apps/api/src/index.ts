import { buildServer } from './server.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const app = await buildServer();

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`API server listening at http://0.0.0.0:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Start workers and QueueEvents bridge if Redis is configured.
// Worker failure is non-fatal: the capture-worker service handles job processing
// in docker-compose, so the API can serve HTTP without local workers.
let queueEventsBridge: { close(): Promise<void> } | null = null;

if (process.env.REDIS_URL) {
  if (process.env.DISABLE_WORKERS !== '1') {
    try {
      const { startWorkers } = await import('./workers/index.js');
      await startWorkers(process.env.REDIS_URL);
      app.log.info('BullMQ workers started');
    } catch (err) {
      app.log.error({ err }, 'Failed to start workers — continuing without workers');
    }
  } else {
    app.log.info('Workers disabled (DISABLE_WORKERS=1) — capture-worker service handles jobs');
  }

  // Bridge BullMQ capture events to WebSocket clients (must run in API server process)
  try {
    const { startQueueEventBridge } = await import('./ws/websocket-bridge.js');
    const { parseRedisUrl } = await import('./workers/parse-redis-url.js');
    queueEventsBridge = startQueueEventBridge(parseRedisUrl(process.env.REDIS_URL) as unknown as Record<string, unknown>);
    app.log.info('QueueEvents WebSocket bridge started');
  } catch (err) {
    app.log.error({ err }, 'Failed to start QueueEvents bridge — continuing without live updates');
  }
}

// Graceful shutdown: close WebSocket connections and QueueEvents bridge before exit
async function gracefulShutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down gracefully`);
  if (queueEventsBridge) {
    await queueEventsBridge.close();
  }
  const { wsManager } = await import('./ws/websocket-manager.js');
  wsManager.shutdown();
  await app.close();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
