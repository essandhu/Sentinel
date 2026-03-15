import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketManager } from './websocket-manager.js';
import type { WsClient } from './websocket-manager.js';
import { EventEmitter } from 'node:events';

/** Minimal mock that satisfies the WebSocket interface used by WebSocketManager */
function createMockSocket(readyState = 1 /* OPEN */) {
  const emitter = new EventEmitter();
  const socket = Object.assign(emitter, {
    readyState,
    OPEN: 1,
    bufferedAmount: 0,
    send: vi.fn(),
    ping: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
  });
  return socket;
}

describe('WebSocketManager', () => {
  let manager: WebSocketManager;

  beforeEach(() => {
    manager = new WebSocketManager();
  });

  afterEach(() => {
    manager.shutdown();
  });

  describe('addClient / clientCount', () => {
    it('registers a client and increments clientCount', () => {
      const ws = createMockSocket();
      manager.addClient(ws as any, 'workspace-1', 'user-1');
      expect(manager.clientCount).toBe(1);
    });

    it('removes client on close event', () => {
      const ws = createMockSocket();
      manager.addClient(ws as any, 'workspace-1', 'user-1');
      expect(manager.clientCount).toBe(1);
      ws.emit('close');
      expect(manager.clientCount).toBe(0);
    });
  });

  describe('broadcast', () => {
    it('delivers message to clients in the same workspace', () => {
      const ws = createMockSocket();
      manager.addClient(ws as any, 'workspace-A', 'user-1');
      manager.broadcast('workspace-A', { type: 'test', payload: 'hello' });
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'test', payload: 'hello' }));
    });

    it('does NOT deliver to clients in a different workspace', () => {
      const wsA = createMockSocket();
      const wsB = createMockSocket();
      manager.addClient(wsA as any, 'workspace-A', 'user-1');
      manager.addClient(wsB as any, 'workspace-B', 'user-2');
      manager.broadcast('workspace-A', { type: 'test', payload: 'only-A' });
      expect(wsA.send).toHaveBeenCalled();
      expect(wsB.send).not.toHaveBeenCalled();
    });

    it('skips clients with readyState !== OPEN', () => {
      const ws = createMockSocket(3 /* CLOSED */);
      manager.addClient(ws as any, 'workspace-A', 'user-1');
      manager.broadcast('workspace-A', { type: 'test', payload: 'nope' });
      expect(ws.send).not.toHaveBeenCalled();
    });

    it('terminates clients exceeding bufferedAmount threshold', () => {
      const ws = createMockSocket();
      ws.bufferedAmount = 2_000_000; // over 1 MiB threshold
      manager.addClient(ws as any, 'workspace-A', 'user-1');
      manager.broadcast('workspace-A', { type: 'test', payload: 'big' });
      expect(ws.send).not.toHaveBeenCalled();
      expect(ws.terminate).toHaveBeenCalled();
    });
  });

  describe('heartbeat', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('terminates clients that miss pong (alive=false after ping)', () => {
      const ws = createMockSocket();
      manager.addClient(ws as any, 'workspace-A', 'user-1');
      manager.startHeartbeat(1000);

      // First tick: sets alive=false, sends ping
      vi.advanceTimersByTime(1000);
      expect(ws.ping).toHaveBeenCalledTimes(1);

      // No pong received. Second tick: alive is still false => terminate
      vi.advanceTimersByTime(1000);
      expect(ws.terminate).toHaveBeenCalled();
    });

    it('keeps alive clients that respond with pong', () => {
      const ws = createMockSocket();
      manager.addClient(ws as any, 'workspace-A', 'user-1');
      manager.startHeartbeat(1000);

      // First tick: sets alive=false, sends ping
      vi.advanceTimersByTime(1000);
      expect(ws.ping).toHaveBeenCalledTimes(1);

      // Simulate pong response
      ws.emit('pong');

      // Second tick: alive is true (from pong) => sets alive=false, sends ping again
      vi.advanceTimersByTime(1000);
      expect(ws.terminate).not.toHaveBeenCalled();
      expect(ws.ping).toHaveBeenCalledTimes(2);
    });
  });

  describe('shutdown', () => {
    it('closes all connections and clears registry', () => {
      const ws1 = createMockSocket();
      const ws2 = createMockSocket();
      manager.addClient(ws1 as any, 'workspace-A', 'user-1');
      manager.addClient(ws2 as any, 'workspace-B', 'user-2');
      manager.shutdown();
      expect(ws1.close).toHaveBeenCalledWith(1001, 'server shutting down');
      expect(ws2.close).toHaveBeenCalledWith(1001, 'server shutting down');
      expect(manager.clientCount).toBe(0);
    });
  });
});
