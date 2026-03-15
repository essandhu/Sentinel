import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthenticateWsConnection = vi.hoisted(() => vi.fn());
const mockAddClient = vi.hoisted(() => vi.fn());

vi.mock('./websocket-auth.js', () => ({
  authenticateWsConnection: mockAuthenticateWsConnection,
}));

vi.mock('./websocket-manager.js', () => ({
  wsManager: { addClient: mockAddClient },
}));

import { registerWsRoute } from './websocket-route.js';

describe('registerWsRoute', () => {
  let mockApp: any;
  let handler: (socket: any, req: any) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Capture the route handler when registerWsRoute is called
    mockApp = {
      get: vi.fn((_path: string, _opts: any, fn: any) => {
        handler = fn;
      }),
    };

    registerWsRoute(mockApp);
  });

  it('registers a GET /ws route with websocket option', () => {
    expect(mockApp.get).toHaveBeenCalledWith(
      '/ws',
      { websocket: true },
      expect.any(Function),
    );
  });

  it('closes socket with 4001 when auth fails (no token)', async () => {
    mockAuthenticateWsConnection.mockResolvedValue(null);
    const mockSocket = { close: vi.fn() };
    const mockReq = {
      url: '/ws',
      headers: { host: 'localhost:3000' },
    };

    await handler(mockSocket, mockReq);

    expect(mockAuthenticateWsConnection).toHaveBeenCalledWith(undefined);
    expect(mockSocket.close).toHaveBeenCalledWith(4001, 'Unauthorized');
    expect(mockAddClient).not.toHaveBeenCalled();
  });

  it('closes socket with 4001 when auth returns null', async () => {
    mockAuthenticateWsConnection.mockResolvedValue(null);
    const mockSocket = { close: vi.fn() };
    const mockReq = {
      url: '/ws?token=bad-token',
      headers: { host: 'localhost:3000' },
    };

    await handler(mockSocket, mockReq);

    expect(mockAuthenticateWsConnection).toHaveBeenCalledWith('bad-token');
    expect(mockSocket.close).toHaveBeenCalledWith(4001, 'Unauthorized');
  });

  it('adds client to wsManager when auth succeeds', async () => {
    mockAuthenticateWsConnection.mockResolvedValue({
      orgId: 'org-123',
      userId: 'user-456',
    });
    const mockSocket = { close: vi.fn() };
    const mockReq = {
      url: '/ws?token=valid-token',
      headers: { host: 'localhost:3000' },
    };

    await handler(mockSocket, mockReq);

    expect(mockAuthenticateWsConnection).toHaveBeenCalledWith('valid-token');
    expect(mockSocket.close).not.toHaveBeenCalled();
    expect(mockAddClient).toHaveBeenCalledWith(mockSocket, 'org-123', 'user-456');
  });

  it('extracts token from query string', async () => {
    mockAuthenticateWsConnection.mockResolvedValue(null);
    const mockSocket = { close: vi.fn() };
    const mockReq = {
      url: '/ws?token=my-jwt-token&other=param',
      headers: { host: 'example.com' },
    };

    await handler(mockSocket, mockReq);

    expect(mockAuthenticateWsConnection).toHaveBeenCalledWith('my-jwt-token');
  });
});
