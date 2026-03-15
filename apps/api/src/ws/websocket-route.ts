import type { FastifyInstance } from 'fastify';
import { authenticateWsConnection } from './websocket-auth.js';
import { wsManager } from './websocket-manager.js';

export function registerWsRoute(app: FastifyInstance) {
  app.get('/ws', { websocket: true }, async (socket, req) => {
    // Extract token from query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    const auth = await authenticateWsConnection(token ?? undefined);
    if (!auth) {
      socket.close(4001, 'Unauthorized');
      return;
    }

    wsManager.addClient(socket, auth.orgId, auth.userId);
  });
}
