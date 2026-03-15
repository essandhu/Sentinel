import type { WebSocket } from 'ws';

export interface WsClient {
  socket: WebSocket;
  workspaceId: string;
  userId: string;
  alive: boolean;
}

const MAX_BUFFERED_AMOUNT = 1_048_576; // 1 MiB

export class WebSocketManager {
  private clients = new Map<WebSocket, WsClient>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  addClient(socket: WebSocket, workspaceId: string, userId: string) {
    const client: WsClient = { socket, workspaceId, userId, alive: true };
    this.clients.set(socket, client);
    socket.on('pong', () => {
      client.alive = true;
    });
    socket.on('close', () => {
      this.clients.delete(socket);
    });
  }

  broadcast(workspaceId: string, event: { type: string; payload: unknown }) {
    const message = JSON.stringify(event);
    for (const [ws, client] of this.clients) {
      if (client.workspaceId !== workspaceId) continue;
      if (ws.readyState !== ws.OPEN) continue;

      // Backpressure protection: terminate slow consumers
      if (ws.bufferedAmount >= MAX_BUFFERED_AMOUNT) {
        ws.terminate();
        this.clients.delete(ws);
        continue;
      }

      ws.send(message);
    }
  }

  startHeartbeat(intervalMs = 30_000) {
    this.heartbeatInterval = setInterval(() => {
      for (const [ws, client] of this.clients) {
        if (!client.alive) {
          ws.terminate();
          this.clients.delete(ws);
          continue;
        }
        client.alive = false;
        ws.ping();
      }
    }, intervalMs);
  }

  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const [ws] of this.clients) {
      ws.close(1001, 'server shutting down');
    }
    this.clients.clear();
  }

  get clientCount() {
    return this.clients.size;
  }
}

export const wsManager = new WebSocketManager();
