import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Hoisted mocks ----------
const mockLoadAll = vi.hoisted(() => vi.fn());
const mockWriteDesignBaselines = vi.hoisted(() => vi.fn());
const mockCreateStorageClient = vi.hoisted(() => vi.fn());

vi.mock('@sentinel/adapters', () => ({
  SketchAdapter: class {
    name = 'sketch';
    loadAll = mockLoadAll;
  },
  registerFigmaWebhook: vi.fn(),
  deleteFigmaWebhook: vi.fn(),
  validatePenpotConnection: vi.fn(),
  verifyFigmaWebhook: vi.fn(),
  FigmaRateLimitError: class extends Error {},
  isRateLimited: vi.fn(),
  persistRateLimit: vi.fn(),
  FigmaAdapter: vi.fn(),
  ImageBaselineAdapter: vi.fn(),
  StorybookAdapter: vi.fn(),
  storybookStoryUrl: vi.fn(),
  PenpotAdapter: vi.fn(),
  DesignTokenAdapter: vi.fn(),
  normalizeColorToHex: vi.fn(),
  extractDesignTokens: vi.fn(),
  FigmaApiError: class extends Error {},
}));

vi.mock('../services/baseline-writer.js', () => ({
  writeDesignBaselines: mockWriteDesignBaselines,
}));

vi.mock('@sentinel/storage', () => ({
  createStorageClient: mockCreateStorageClient,
  uploadBuffer: vi.fn(),
}));

vi.mock('@sentinel/db', () => ({
  createDb: vi.fn(() => ({})),
  workspaceSettings: {},
  projects: {},
  captureRuns: {},
  snapshots: {},
  baselines: {},
  diffReports: {},
  approvalDecisions: {},
}));

vi.mock('@clerk/fastify', () => ({
  getAuth: vi.fn(() => ({ userId: 'user_test123' })),
  clerkPlugin: vi.fn(),
}));

describe('sketch-upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateStorageClient.mockReturnValue({});
  });

  it('POST /api/sketch/upload with .sketch file + projectId returns 200 with artboard metadata', async () => {
    const mockSpecs = [
      {
        sourceType: 'sketch' as const,
        referenceImage: Buffer.from('img1'),
        tokens: {},
        metadata: { componentName: 'Artboard1', sketchArtboardId: 'ab-1' },
      },
      {
        sourceType: 'sketch' as const,
        referenceImage: Buffer.from('img2'),
        tokens: {},
        metadata: { componentName: 'Artboard2', sketchArtboardId: 'ab-2' },
      },
    ];

    mockLoadAll.mockResolvedValue(mockSpecs);
    mockWriteDesignBaselines.mockResolvedValue({ baselineCount: 2 });

    const { registerSketchUploadRoute } = await import('./sketch-upload.js');
    const Fastify = (await import('fastify')).default;
    const multipart = (await import('@fastify/multipart')).default;

    const app = Fastify();
    await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
    registerSketchUploadRoute(app);
    await app.ready();

    // Create a multipart form body manually
    const boundary = '----TestBoundary';
    const sketchBuffer = Buffer.from('PK\x03\x04fake-sketch-data');
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="projectId"',
      '',
      '00000000-0000-4000-a000-000000000001',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="design.sketch"',
      'Content-Type: application/octet-stream',
      '',
      sketchBuffer.toString('binary'),
      `--${boundary}--`,
    ].join('\r\n');

    const response = await app.inject({
      method: 'POST',
      url: '/api/sketch/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(json.artboards).toEqual([
      { name: 'Artboard1', artboardId: 'ab-1' },
      { name: 'Artboard2', artboardId: 'ab-2' },
    ]);
    expect(json.baselineCount).toBe(2);
    expect(mockLoadAll).toHaveBeenCalled();
    expect(mockWriteDesignBaselines).toHaveBeenCalled();

    await app.close();
  });

  it('POST /api/sketch/upload without a file returns 400', async () => {
    const { registerSketchUploadRoute } = await import('./sketch-upload.js');
    const Fastify = (await import('fastify')).default;
    const multipart = (await import('@fastify/multipart')).default;

    const app = Fastify();
    await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
    registerSketchUploadRoute(app);
    await app.ready();

    // Send multipart with only projectId, no file
    const boundary = '----TestBoundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="projectId"',
      '',
      '00000000-0000-4000-a000-000000000001',
      `--${boundary}--`,
    ].join('\r\n');

    const response = await app.inject({
      method: 'POST',
      url: '/api/sketch/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/file/i);

    await app.close();
  });

  it('POST /api/sketch/upload without projectId returns 400', async () => {
    const { registerSketchUploadRoute } = await import('./sketch-upload.js');
    const Fastify = (await import('fastify')).default;
    const multipart = (await import('@fastify/multipart')).default;

    const app = Fastify();
    await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
    registerSketchUploadRoute(app);
    await app.ready();

    const boundary = '----TestBoundary';
    const sketchBuffer = Buffer.from('PK\x03\x04fake-sketch');
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="design.sketch"',
      'Content-Type: application/octet-stream',
      '',
      sketchBuffer.toString('binary'),
      `--${boundary}--`,
    ].join('\r\n');

    const response = await app.inject({
      method: 'POST',
      url: '/api/sketch/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/projectId/i);

    await app.close();
  });

  it('calls SketchAdapter.loadAll with temp file path and writeDesignBaselines with results', async () => {
    const mockSpecs = [
      {
        sourceType: 'sketch' as const,
        referenceImage: Buffer.from('img'),
        tokens: {},
        metadata: { componentName: 'Button', sketchArtboardId: 'ab-btn' },
      },
    ];

    mockLoadAll.mockResolvedValue(mockSpecs);
    mockWriteDesignBaselines.mockResolvedValue({ baselineCount: 1 });

    const { registerSketchUploadRoute } = await import('./sketch-upload.js');
    const Fastify = (await import('fastify')).default;
    const multipart = (await import('@fastify/multipart')).default;

    const app = Fastify();
    await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
    registerSketchUploadRoute(app);
    await app.ready();

    const boundary = '----TestBoundary';
    const sketchBuffer = Buffer.from('PK\x03\x04fake-sketch-data');
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="projectId"',
      '',
      '00000000-0000-4000-a000-000000000001',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="design.sketch"',
      'Content-Type: application/octet-stream',
      '',
      sketchBuffer.toString('binary'),
      `--${boundary}--`,
    ].join('\r\n');

    await app.inject({
      method: 'POST',
      url: '/api/sketch/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    // Verify SketchAdapter.loadAll was called with a config containing filePath
    expect(mockLoadAll).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: expect.stringContaining('.sketch') }),
    );

    // Verify writeDesignBaselines was called with the resulting specs
    expect(mockWriteDesignBaselines).toHaveBeenCalledWith(
      mockSpecs,
      '00000000-0000-4000-a000-000000000001',
      expect.any(String), // userId
      expect.anything(), // storageClient
      expect.any(String), // bucket
      expect.anything(), // db
    );

    await app.close();
  });
});
