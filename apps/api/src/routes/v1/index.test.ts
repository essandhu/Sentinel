import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all sub-route registrations
const mockRegisterProjectRoutes = vi.hoisted(() => vi.fn());
const mockRegisterCaptureRoutes = vi.hoisted(() => vi.fn());
const mockRegisterDiffRoutes = vi.hoisted(() => vi.fn());
const mockRegisterComponentRoutes = vi.hoisted(() => vi.fn());
const mockRegisterHealthScoreRoutes = vi.hoisted(() => vi.fn());
const mockRegisterApprovalRoutes = vi.hoisted(() => vi.fn());
const mockRegisterCaptureTriggerRoutes = vi.hoisted(() => vi.fn());
const mockAuthenticateApiKey = vi.hoisted(() => vi.fn());

vi.mock('./auth.js', () => ({
  authenticateApiKey: mockAuthenticateApiKey,
}));
vi.mock('./projects.js', () => ({
  registerProjectRoutes: mockRegisterProjectRoutes,
}));
vi.mock('./captures.js', () => ({
  registerCaptureRoutes: mockRegisterCaptureRoutes,
}));
vi.mock('./diffs.js', () => ({
  registerDiffRoutes: mockRegisterDiffRoutes,
}));
vi.mock('./components.js', () => ({
  registerComponentRoutes: mockRegisterComponentRoutes,
}));
vi.mock('./health-scores.js', () => ({
  registerHealthScoreRoutes: mockRegisterHealthScoreRoutes,
}));
vi.mock('./approvals.js', () => ({
  registerApprovalRoutes: mockRegisterApprovalRoutes,
}));
vi.mock('./captures-trigger.js', () => ({
  registerCaptureTriggerRoutes: mockRegisterCaptureTriggerRoutes,
}));

// Mock Fastify plugins
vi.mock('@fastify/swagger', () => ({
  default: vi.fn(),
}));
vi.mock('@fastify/swagger-ui', () => ({
  default: vi.fn(),
}));
vi.mock('@fastify/rate-limit', () => ({
  default: vi.fn(),
}));
vi.mock('ioredis', () => ({
  Redis: vi.fn(),
}));

import { v1RestApi } from './index.js';

describe('v1RestApi', () => {
  let mockApp: any;
  let hookCallbacks: Record<string, Function>;
  let routeHandlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    hookCallbacks = {};
    routeHandlers = {};

    mockApp = {
      register: vi.fn().mockResolvedValue(undefined),
      addHook: vi.fn((hookName: string, fn: Function) => {
        hookCallbacks[hookName] = fn;
      }),
      get: vi.fn((path: string, _opts: any, handler: Function) => {
        routeHandlers[path] = handler;
      }),
    };
  });

  it('registers rate limit, swagger, swagger-ui plugins', async () => {
    await v1RestApi(mockApp);

    // 3 plugins: rateLimit, swagger, swaggerUi
    expect(mockApp.register).toHaveBeenCalledTimes(3);
  });

  it('registers onRequest auth hook', async () => {
    await v1RestApi(mockApp);

    expect(mockApp.addHook).toHaveBeenCalledWith('onRequest', mockAuthenticateApiKey);
  });

  it('registers all resource route groups', async () => {
    await v1RestApi(mockApp);

    expect(mockRegisterProjectRoutes).toHaveBeenCalledWith(mockApp);
    expect(mockRegisterCaptureRoutes).toHaveBeenCalledWith(mockApp);
    expect(mockRegisterDiffRoutes).toHaveBeenCalledWith(mockApp);
    expect(mockRegisterComponentRoutes).toHaveBeenCalledWith(mockApp);
    expect(mockRegisterHealthScoreRoutes).toHaveBeenCalledWith(mockApp);
    expect(mockRegisterApprovalRoutes).toHaveBeenCalledWith(mockApp);
    expect(mockRegisterCaptureTriggerRoutes).toHaveBeenCalledWith(mockApp);
  });

  it('registers root GET / route that returns name and version', async () => {
    await v1RestApi(mockApp);

    expect(mockApp.get).toHaveBeenCalledWith(
      '/',
      expect.objectContaining({ schema: expect.any(Object) }),
      expect.any(Function),
    );

    const result = await routeHandlers['/']();
    expect(result).toEqual({ name: 'Sentinel API', version: '1.0.0' });
  });
});
