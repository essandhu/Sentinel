import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockVerifyFigmaWebhook = vi.hoisted(() => vi.fn());
const mockCreateDb = vi.hoisted(() => vi.fn());
const mockDecrypt = vi.hoisted(() => vi.fn());
const mockGetCaptureQueue = vi.hoisted(() => vi.fn());

vi.mock('@sentinel/adapters', () => ({
  verifyFigmaWebhook: mockVerifyFigmaWebhook,
}));

vi.mock('@sentinel/db', () => ({
  createDb: mockCreateDb,
  workspaceSettings: {
    figmaFileKey: 'workspaceSettings.figmaFileKey',
    figmaWebhookPasscode: 'workspaceSettings.figmaWebhookPasscode',
    figmaAccessToken: 'workspaceSettings.figmaAccessToken',
    workspaceId: 'workspaceSettings.workspaceId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
}));

vi.mock('../services/crypto.js', () => ({
  decrypt: mockDecrypt,
}));

vi.mock('../queue.js', () => ({
  getCaptureQueue: mockGetCaptureQueue,
}));

describe('figma-webhook-handler', () => {
  let capturedPlugin: (instance: any) => Promise<void>;
  let routeHandler: (req: any, reply: any) => Promise<any>;
  const mockApp = {
    register: vi.fn(async (plugin: any) => {
      capturedPlugin = plugin;
    }),
  };

  const mockAdd = vi.fn().mockResolvedValue({});
  const mockQueue = { add: mockAdd };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetCaptureQueue.mockReturnValue(mockQueue);
    mockDecrypt.mockImplementation((val: string) => val.replace('enc:', ''));

    // Import and register the route
    const { registerFigmaWebhookRoute } = await import('./figma-webhook-handler.js');
    registerFigmaWebhookRoute(mockApp as any);

    // Execute the plugin to capture the route handler
    const pluginInstance = {
      addContentTypeParser: vi.fn(),
      post: vi.fn((path: string, handler: any) => {
        routeHandler = handler;
      }),
    };
    await capturedPlugin(pluginInstance);
  });

  it('returns 200 and enqueues job when signature is valid', async () => {
    const rawBody = '{"file_key":"fk-123","event_type":"LIBRARY_PUBLISH"}';
    const req = {
      headers: { 'figma-signature': 'valid-sig' },
      rawBody: Buffer.from(rawBody),
      body: { file_key: 'fk-123', event_type: 'LIBRARY_PUBLISH' },
    };

    const mockWhere = vi.fn().mockResolvedValue([{
      workspaceId: 'ws-1',
      figmaWebhookPasscode: 'enc:passcode-secret',
      figmaAccessToken: 'enc:tok-abc',
    }]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    mockCreateDb.mockReturnValue({ select: mockSelect });

    mockVerifyFigmaWebhook.mockReturnValue(true);

    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    const result = await routeHandler(req, reply);

    // Verify HMAC was called with raw body string, not JSON.stringify(parsed)
    expect(mockVerifyFigmaWebhook).toHaveBeenCalledWith(
      rawBody,
      'valid-sig',
      'passcode-secret',
    );

    // Verify job was enqueued
    expect(mockAdd).toHaveBeenCalledWith('figma-resync', {
      fileKey: 'fk-123',
      workspaceId: 'ws-1',
    });

    expect(result).toEqual({ ok: true });
  });

  it('returns 401 when signature is invalid', async () => {
    const rawBody = '{"file_key":"fk-123"}';
    const req = {
      headers: { 'figma-signature': 'bad-sig' },
      rawBody: Buffer.from(rawBody),
      body: { file_key: 'fk-123' },
    };

    const mockWhere = vi.fn().mockResolvedValue([{
      workspaceId: 'ws-1',
      figmaWebhookPasscode: 'enc:passcode-secret',
    }]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    mockCreateDb.mockReturnValue({ select: mockSelect });

    mockVerifyFigmaWebhook.mockReturnValue(false);

    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await routeHandler(req, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Invalid signature' });
  });

  it('returns 401 when figma-signature header is missing', async () => {
    const req = {
      headers: {},
      rawBody: Buffer.from('{}'),
      body: {},
    };

    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await routeHandler(req, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Missing signature' });
  });

  it('returns 200 silently when no workspace matches the file_key', async () => {
    const rawBody = '{"file_key":"unknown-fk"}';
    const req = {
      headers: { 'figma-signature': 'some-sig' },
      rawBody: Buffer.from(rawBody),
      body: { file_key: 'unknown-fk' },
    };

    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    mockCreateDb.mockReturnValue({ select: mockSelect });

    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    const result = await routeHandler(req, reply);

    expect(result).toEqual({ ok: true });
    expect(mockAdd).not.toHaveBeenCalled();
  });
});
