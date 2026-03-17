import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Mock all heavy dependencies to test server wiring without real services
vi.mock('@fastify/cors', () => ({ default: async () => {} }));
vi.mock('@fastify/websocket', () => ({ default: async () => {} }));
vi.mock('@fastify/multipart', () => ({ default: async () => {} }));
vi.mock('@trpc/server/adapters/fastify', () => ({
  fastifyTRPCPlugin: async () => {},
}));
vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: class {},
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/signed'),
}));
vi.mock('@sentinel-vrt/storage', () => ({
  createStorageClient: vi.fn(() => ({})),
}));
vi.mock('./routers/index.js', () => ({
  appRouter: {},
}));
vi.mock('./context.js', () => ({
  createContext: vi.fn(),
}));
vi.mock('./webhooks/figma-webhook-handler.js', () => ({
  registerFigmaWebhookRoute: vi.fn(),
}));
vi.mock('./webhooks/github-merge-handler.js', () => ({
  registerGithubMergeWebhookRoute: vi.fn(),
}));
vi.mock('./routes/sketch-upload.js', () => ({
  registerSketchUploadRoute: vi.fn(),
}));
vi.mock('./routes/v1/index.js', () => ({
  v1RestApi: async () => {},
}));
vi.mock('./graphql/index.js', () => ({
  registerGraphQL: vi.fn(),
}));
vi.mock('./ws/websocket-route.js', () => ({
  registerWsRoute: vi.fn(),
}));
vi.mock('./ws/websocket-manager.js', () => ({
  wsManager: { startHeartbeat: vi.fn() },
}));

describe('buildServer', () => {
  let buildServer: typeof import('./server.js')['buildServer'];

  beforeEach(async () => {
    vi.clearAllMocks();
    delete process.env.CLERK_SECRET_KEY;
    const mod = await import('./server.js');
    buildServer = mod.buildServer;
  });

  afterAll(() => {
    delete process.env.CLERK_SECRET_KEY;
  });

  it('returns a Fastify instance', async () => {
    const app = await buildServer();
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
    expect(typeof app.close).toBe('function');
    await app.close();
  });

  it('registers health check endpoint that returns ok', async () => {
    const app = await buildServer();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
    await app.close();
  });

  it('registers webhook handlers', async () => {
    const { registerFigmaWebhookRoute } = await import('./webhooks/figma-webhook-handler.js');
    const { registerGithubMergeWebhookRoute } = await import('./webhooks/github-merge-handler.js');
    const { registerSketchUploadRoute } = await import('./routes/sketch-upload.js');

    await buildServer();

    expect(registerFigmaWebhookRoute).toHaveBeenCalled();
    expect(registerGithubMergeWebhookRoute).toHaveBeenCalled();
    expect(registerSketchUploadRoute).toHaveBeenCalled();
  });

  it('registers WebSocket route and starts heartbeat', async () => {
    const { registerWsRoute } = await import('./ws/websocket-route.js');
    const { wsManager } = await import('./ws/websocket-manager.js');

    await buildServer();

    expect(registerWsRoute).toHaveBeenCalled();
    expect(wsManager.startHeartbeat).toHaveBeenCalled();
  });

  it('registers GraphQL endpoint', async () => {
    const { registerGraphQL } = await import('./graphql/index.js');

    await buildServer();

    expect(registerGraphQL).toHaveBeenCalled();
  });

  it('skips Clerk plugin when CLERK_SECRET_KEY is not set', async () => {
    const app = await buildServer();
    // Server should build successfully without Clerk
    expect(app).toBeDefined();
    await app.close();
  });
});
