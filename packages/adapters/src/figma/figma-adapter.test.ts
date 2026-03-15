import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';

// ─── Figma Client Tests ───────────────────────────────────────────────────────

describe('fetchFigmaImages', () => {
  let fetchFigmaImages: typeof import('./figma-client.js').fetchFigmaImages;
  let FigmaRateLimitError: typeof import('./figma-client.js').FigmaRateLimitError;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./figma-client.js');
    fetchFigmaImages = mod.fetchFigmaImages;
    FigmaRateLimitError = mod.FigmaRateLimitError;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls Figma /v1/images/:key with correct headers and params on success', async () => {
    const mockResponse = {
      images: { 'node-1': 'https://s3.figma.com/signed/image.png' },
      err: null,
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchFigmaImages('file-key-123', ['node-1'], 'tok-abc');
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/images/file-key-123');
    expect(url).toContain('ids=node-1');
    expect(url).toContain('format=png');
    expect((init.headers as Record<string, string>)['X-Figma-Token']).toBe('tok-abc');
    expect((init.headers as Record<string, string>)['Accept']).toBe('application/json');
    expect(result).toEqual(mockResponse);
  });

  it('throws FigmaRateLimitError on 429 response with correct retryAfterTimestamp', async () => {
    const retryAfterSeconds = 120;
    const beforeCall = Date.now();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Rate limited', {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
          'X-RateLimit-Type': 'per_minute',
        },
      }),
    );

    try {
      await fetchFigmaImages('file-key', ['node-1'], 'tok-abc');
      expect.fail('Should have thrown');
    } catch (err) {
      const e = err as InstanceType<typeof FigmaRateLimitError>;
      expect(e).toBeInstanceOf(FigmaRateLimitError);
      const minExpected = beforeCall + retryAfterSeconds * 1000;
      expect(e.retryAfterTimestamp).toBeGreaterThanOrEqual(minExpected);
      expect(e.retryAfterTimestamp).toBeLessThan(minExpected + 5000);
    }
  });

  it('uses default 60s retry when Retry-After header is missing on 429', async () => {
    const beforeCall = Date.now();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Rate limited', { status: 429 }),
    );

    try {
      await fetchFigmaImages('file-key', ['node-1'], 'tok-abc');
      expect.fail('Should have thrown');
    } catch (err) {
      const e = err as InstanceType<typeof FigmaRateLimitError>;
      expect(e).toBeInstanceOf(FigmaRateLimitError);
      expect(e.retryAfterTimestamp).toBeGreaterThanOrEqual(beforeCall + 60 * 1000);
    }
  });

  it('throws generic Error on non-OK non-429 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    await expect(fetchFigmaImages('file-key', ['node-1'], 'tok-abc')).rejects.toThrow(
      /404/,
    );
  });

  it('FigmaRateLimitError has limitType from X-RateLimit-Type header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Rate limited', {
        status: 429,
        headers: {
          'Retry-After': '30',
          'X-RateLimit-Type': 'per_hour',
        },
      }),
    );

    try {
      await fetchFigmaImages('file-key', ['node-1'], 'tok-abc');
      expect.fail('Should have thrown');
    } catch (err) {
      const e = err as InstanceType<typeof FigmaRateLimitError>;
      expect(e.limitType).toBe('per_hour');
    }
  });
});

// ─── Cache Key Tests ──────────────────────────────────────────────────────────

describe('figmaCacheKey', () => {
  let figmaCacheKey: typeof import('./figma-cache.js').figmaCacheKey;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./figma-cache.js');
    figmaCacheKey = mod.figmaCacheKey;
  });

  it('returns figma-cache/{sha256hex}.png format', () => {
    const bytes = Buffer.from('hello world');
    const key = figmaCacheKey(bytes);
    const expectedHash = createHash('sha256').update(bytes).digest('hex');
    expect(key).toBe(`figma-cache/${expectedHash}.png`);
  });

  it('same image bytes always produce the same cache key', () => {
    const bytes = Buffer.from('test-image-data-12345');
    expect(figmaCacheKey(bytes)).toBe(figmaCacheKey(Buffer.from('test-image-data-12345')));
  });

  it('different image bytes produce different cache keys', () => {
    const key1 = figmaCacheKey(Buffer.from('image-a'));
    const key2 = figmaCacheKey(Buffer.from('image-b'));
    expect(key1).not.toBe(key2);
  });
});

describe('checkCacheHit', () => {
  let checkCacheHit: typeof import('./figma-cache.js').checkCacheHit;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./figma-cache.js');
    checkCacheHit = mod.checkCacheHit;
  });

  it('returns true when S3 HeadObject succeeds', async () => {
    const mockS3 = {
      send: vi.fn().mockResolvedValue({}),
    } as any;
    const result = await checkCacheHit(mockS3, 'my-bucket', 'figma-cache/abc.png');
    expect(result).toBe(true);
  });

  it('returns false when S3 HeadObject throws (cache miss)', async () => {
    const mockS3 = {
      send: vi.fn().mockRejectedValue(new Error('NoSuchKey')),
    } as any;
    const result = await checkCacheHit(mockS3, 'my-bucket', 'figma-cache/abc.png');
    expect(result).toBe(false);
  });
});

// ─── Rate Limit Persistence Tests ────────────────────────────────────────────

describe('isRateLimited and persistRateLimit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('isRateLimited() returns false when no adapter_state row exists', async () => {
    vi.doMock('@sentinel/db', () => ({
      createDb: vi.fn().mockReturnValue({
        query: {
          adapterState: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      }),
      adapterState: {},
    }));
    vi.doMock('drizzle-orm', () => ({
      eq: vi.fn(),
    }));
    const { isRateLimited } = await import('./figma-adapter.js');
    const result = await isRateLimited('postgres://localhost/test');
    expect(result).toBe(false);
  });

  it('isRateLimited() returns true when retryAfterTimestamp is in the future', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    vi.doMock('@sentinel/db', () => ({
      createDb: vi.fn().mockReturnValue({
        query: {
          adapterState: {
            findFirst: vi.fn().mockResolvedValue({
              retryAfterTimestamp: futureDate,
            }),
          },
        },
      }),
      adapterState: {},
    }));
    vi.doMock('drizzle-orm', () => ({
      eq: vi.fn(),
    }));
    vi.resetModules();
    // Re-register mocks after resetModules
    vi.doMock('@sentinel/db', () => ({
      createDb: vi.fn().mockReturnValue({
        query: {
          adapterState: {
            findFirst: vi.fn().mockResolvedValue({
              retryAfterTimestamp: futureDate,
            }),
          },
        },
      }),
      adapterState: {},
    }));
    vi.doMock('drizzle-orm', () => ({
      eq: vi.fn(),
    }));
    const { isRateLimited } = await import('./figma-adapter.js');
    const result = await isRateLimited('postgres://localhost/test');
    expect(result).toBe(true);
  });

  it('isRateLimited() returns false when retryAfterTimestamp is in the past', async () => {
    const pastDate = new Date(Date.now() - 60_000);
    vi.resetModules();
    vi.doMock('@sentinel/db', () => ({
      createDb: vi.fn().mockReturnValue({
        query: {
          adapterState: {
            findFirst: vi.fn().mockResolvedValue({
              retryAfterTimestamp: pastDate,
            }),
          },
        },
      }),
      adapterState: {},
    }));
    vi.doMock('drizzle-orm', () => ({
      eq: vi.fn(),
    }));
    const { isRateLimited } = await import('./figma-adapter.js');
    const result = await isRateLimited('postgres://localhost/test');
    expect(result).toBe(false);
  });

  it('persistRateLimit() calls db insert with correct values', async () => {
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    vi.resetModules();
    vi.doMock('@sentinel/db', () => ({
      createDb: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
      adapterState: { adapterName: 'adapter_name' },
    }));
    vi.doMock('drizzle-orm', () => ({
      eq: vi.fn(),
    }));
    const { persistRateLimit } = await import('./figma-adapter.js');
    const ts = Date.now() + 30_000;
    await persistRateLimit('postgres://localhost/test', ts, 'per_minute');
    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockValues).toHaveBeenCalledOnce();
    expect(mockOnConflictDoUpdate).toHaveBeenCalledOnce();
    const insertedValues = mockValues.mock.calls[0][0];
    expect(insertedValues.adapterName).toBe('figma');
    expect(insertedValues.retryAfterTimestamp).toBeInstanceOf(Date);
    expect(insertedValues.rateLimitType).toBe('per_minute');
  });
});

// ─── FigmaAdapter Orchestration Tests ────────────────────────────────────────

describe('FigmaAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseConfig = {
    accessToken: 'tok-test',
    fileKey: 'file-abc',
    nodeIds: ['node-1', 'node-2'],
    cacheBucket: 'sentinel-cache',
    dbConnectionString: 'postgres://localhost/test',
  };

  function makeS3Mock(cacheHit: boolean = false): any {
    return {
      send: vi.fn().mockImplementation((cmd: any) => {
        const cmdName = cmd.constructor?.name ?? '';
        if (cmdName === 'HeadObjectCommand') {
          if (cacheHit) return Promise.resolve({});
          return Promise.reject(new Error('NoSuchKey'));
        }
        if (cmdName === 'PutObjectCommand') return Promise.resolve({});
        if (cmdName === 'GetObjectCommand') {
          // Return a fake stream
          const { Readable } = require('node:stream');
          const stream = new Readable({ read() {} });
          stream.push(Buffer.from('cached-image'));
          stream.push(null);
          return Promise.resolve({ Body: stream });
        }
        return Promise.resolve({});
      }),
    };
  }

  function makeFetchFigmaImagesMock(nodeIds: string[]): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValue({
      images: Object.fromEntries(nodeIds.map((id) => [id, `https://cdn.figma.com/${id}.png`])),
    });
  }

  it('FigmaAdapter has name "figma"', async () => {
    const { FigmaAdapter } = await import('./figma-adapter.js');
    const adapter = new FigmaAdapter({ db: {} as any, s3: makeS3Mock() });
    expect(adapter.name).toBe('figma');
  });

  it('loadAll() throws when rate limit is active without calling Figma API', async () => {
    vi.resetModules();
    const { FigmaAdapter } = await import('./figma-adapter.js');

    const mockFetch = vi.spyOn(globalThis, 'fetch');

    const adapter = new FigmaAdapter({
      db: {} as any,
      s3: makeS3Mock(),
      isRateLimitedFn: vi.fn().mockResolvedValue(true),
      persistRateLimitFn: vi.fn().mockResolvedValue(undefined),
    });

    await expect(adapter.loadAll(baseConfig)).rejects.toThrow(/rate limit/i);
    // fetch should not have been called for Figma API
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('loadAll() returns 2 DesignSpecs for 2 node IDs on cache miss', async () => {
    vi.resetModules();
    const { FigmaAdapter, FigmaRateLimitError: _FRE } = await import('./figma-adapter.js');

    // Mock the Figma API call
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        // This is for fetchFigmaImages - but fetchFigmaImages is imported directly
        // so we need to mock the module
        new Response(Buffer.from('img-1')),
      );

    // Use module-level mock via vi.doMock pattern
    // Instead, use direct dependency injection via fetchFigmaImagesFn
    // The current design doesn't inject fetchFigmaImages, so we mock global fetch

    // Mock fetch: first call returns JSON (Figma API), then image downloads
    vi.restoreAllMocks();
    const figmaApiResponse = {
      images: {
        'node-1': 'https://cdn.figma.com/1.png',
        'node-2': 'https://cdn.figma.com/2.png',
      },
    };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(figmaApiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(Buffer.from('image-bytes-1')))
      .mockResolvedValueOnce(new Response(Buffer.from('image-bytes-2')));

    const s3Mock = makeS3Mock(false); // no cache hits
    const adapter = new FigmaAdapter({
      db: {} as any,
      s3: s3Mock,
      isRateLimitedFn: vi.fn().mockResolvedValue(false),
      persistRateLimitFn: vi.fn().mockResolvedValue(undefined),
    });

    const specs = await adapter.loadAll(baseConfig);
    expect(specs).toHaveLength(2);
    for (const spec of specs) {
      expect(spec.sourceType).toBe('figma');
      expect(spec.referenceImage).toBeInstanceOf(Buffer);
      expect(spec.metadata.figmaNodeId).toBeDefined();
      expect(spec.metadata.capturedAt).toBeDefined();
    }
  });

  it('loadAll() uses readFromCache when checkCacheHit returns true', async () => {
    vi.resetModules();
    const { FigmaAdapter } = await import('./figma-adapter.js');

    const figmaApiResponse = {
      images: {
        'node-1': 'https://cdn.figma.com/1.png',
        'node-2': 'https://cdn.figma.com/2.png',
      },
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(figmaApiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(Buffer.from('image-bytes-1')))
      .mockResolvedValueOnce(new Response(Buffer.from('image-bytes-2')));

    const s3Mock = makeS3Mock(true); // all cache hits
    const adapter = new FigmaAdapter({
      db: {} as any,
      s3: s3Mock,
      isRateLimitedFn: vi.fn().mockResolvedValue(false),
      persistRateLimitFn: vi.fn().mockResolvedValue(undefined),
    });

    const specs = await adapter.loadAll(baseConfig);
    expect(specs).toHaveLength(2);
    // All specs should have cached image bytes
    for (const spec of specs) {
      expect(spec.referenceImage).toBeInstanceOf(Buffer);
    }
    // PutObjectCommand should not have been called (cache hit — no write needed)
    const sentCommands = s3Mock.send.mock.calls.map((c: any[]) => c[0]?.constructor?.name);
    expect(sentCommands).not.toContain('PutObjectCommand');
  });

  it('loadAll() on FigmaRateLimitError calls persistRateLimitFn then re-throws', async () => {
    vi.resetModules();
    const { FigmaAdapter, FigmaRateLimitError } = await import('./figma-adapter.js');

    const mockPersistRateLimit = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Rate limited', {
        status: 429,
        headers: { 'Retry-After': '60', 'X-RateLimit-Type': 'per_minute' },
      }),
    );

    const adapter = new FigmaAdapter({
      db: {} as any,
      s3: makeS3Mock(),
      isRateLimitedFn: vi.fn().mockResolvedValue(false),
      persistRateLimitFn: mockPersistRateLimit,
    });

    await expect(adapter.loadAll(baseConfig)).rejects.toThrow(FigmaRateLimitError);
    expect(mockPersistRateLimit).toHaveBeenCalledOnce();
    const [_connStr, retryAfterMs, limitType] = mockPersistRateLimit.mock.calls[0];
    expect(retryAfterMs).toBeGreaterThan(Date.now());
    expect(limitType).toBe('per_minute');
  });

  it('load() returns first DesignSpec', async () => {
    vi.resetModules();
    const { FigmaAdapter } = await import('./figma-adapter.js');

    const figmaApiResponse = {
      images: {
        'node-1': 'https://cdn.figma.com/1.png',
        'node-2': 'https://cdn.figma.com/2.png',
      },
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(figmaApiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(Buffer.from('image-bytes-1')))
      .mockResolvedValueOnce(new Response(Buffer.from('image-bytes-2')));

    const adapter = new FigmaAdapter({
      db: {} as any,
      s3: makeS3Mock(false),
      isRateLimitedFn: vi.fn().mockResolvedValue(false),
      persistRateLimitFn: vi.fn().mockResolvedValue(undefined),
    });

    const spec = await adapter.load(baseConfig);
    expect(spec).toBeDefined();
    expect(spec.sourceType).toBe('figma');
    expect(spec.referenceImage).toBeInstanceOf(Buffer);
  });

  it('node IDs > 10 are batched into multiple Figma API calls', async () => {
    vi.resetModules();
    const { FigmaAdapter } = await import('./figma-adapter.js');

    const nodeIds = Array.from({ length: 15 }, (_, i) => `node-${i}`);
    const batch1Images = Object.fromEntries(
      nodeIds.slice(0, 10).map((id) => [id, `https://cdn.figma.com/${id}.png`]),
    );
    const batch2Images = Object.fromEntries(
      nodeIds.slice(10).map((id) => [id, `https://cdn.figma.com/${id}.png`]),
    );

    let figmaApiCallCount = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('api.figma.com')) {
        figmaApiCallCount++;
        const images = figmaApiCallCount === 1 ? batch1Images : batch2Images;
        return new Response(JSON.stringify({ images }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Image download
      return new Response(Buffer.from('image-data'));
    });

    const adapter = new FigmaAdapter({
      db: {} as any,
      s3: makeS3Mock(false),
      isRateLimitedFn: vi.fn().mockResolvedValue(false),
      persistRateLimitFn: vi.fn().mockResolvedValue(undefined),
    });

    await adapter.loadAll({ ...baseConfig, nodeIds });

    // 15 nodes split into 10 + 5 = 2 Figma API calls
    expect(figmaApiCallCount).toBe(2);
  });
});
