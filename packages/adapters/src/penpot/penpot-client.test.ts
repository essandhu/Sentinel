import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('penpotRpc', () => {
  let penpotRpc: typeof import('./penpot-client.js').penpotRpc;
  let PenpotApiError: typeof import('./penpot-client.js').PenpotApiError;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import('./penpot-client.js');
    penpotRpc = mod.penpotRpc;
    PenpotApiError = mod.PenpotApiError;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs correct GET URL for get-profile command (no body)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'u1' }), { status: 200 }),
    );

    await penpotRpc('https://penpot.example.com', 'get-profile', 'tok-123');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://penpot.example.com/api/rpc/command/get-profile');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('constructs correct POST URL with JSON body for get-file command', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );

    await penpotRpc('https://penpot.example.com/', 'get-file', 'tok-123', { id: 'file-1', components: true });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    // Trailing slash should be stripped
    expect(url).toBe('https://penpot.example.com/api/rpc/command/get-file');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ id: 'file-1', components: true }));
  });

  it('sends Authorization Token header and Accept application/json', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    await penpotRpc('https://penpot.example.com', 'get-profile', 'my-secret-token');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Token my-secret-token');
    expect(headers['Accept']).toBe('application/json');
  });

  it('throws PenpotApiError with status on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Forbidden', { status: 403 }),
    );

    try {
      await penpotRpc('https://penpot.example.com', 'get-profile', 'bad-token');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PenpotApiError);
      expect((err as InstanceType<typeof PenpotApiError>).status).toBe(403);
    }
  });
});

describe('validatePenpotConnection', () => {
  let validatePenpotConnection: typeof import('./penpot-client.js').validatePenpotConnection;
  let PenpotApiError: typeof import('./penpot-client.js').PenpotApiError;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import('./penpot-client.js');
    validatePenpotConnection = mod.validatePenpotConnection;
    PenpotApiError = mod.PenpotApiError;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns profile data on 200', async () => {
    const profile = { id: 'user-1', fullname: 'Jane Doe', email: 'jane@example.com' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(profile), { status: 200 }),
    );

    const result = await validatePenpotConnection('https://penpot.example.com', 'tok-valid');
    expect(result).toEqual(profile);
  });

  it('throws on invalid token (401)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );

    try {
      await validatePenpotConnection('https://penpot.example.com', 'tok-invalid');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PenpotApiError);
      expect((err as InstanceType<typeof PenpotApiError>).status).toBe(401);
    }
  });
});

describe('getPenpotFileComponents', () => {
  let getPenpotFileComponents: typeof import('./penpot-client.js').getPenpotFileComponents;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import('./penpot-client.js');
    getPenpotFileComponents = mod.getPenpotFileComponents;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts components from file data', async () => {
    const fileResponse = {
      data: {
        components: {
          'comp-1': { id: 'comp-1', name: 'Button', type: 'component' },
          'comp-2': { id: 'comp-2', name: 'Card', type: 'component' },
        },
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(fileResponse), { status: 200 }),
    );

    const components = await getPenpotFileComponents('https://penpot.example.com', 'tok-123', 'file-1');
    expect(components).toHaveLength(2);
    expect(components).toContainEqual({ id: 'comp-1', name: 'Button', type: 'component' });
    expect(components).toContainEqual({ id: 'comp-2', name: 'Card', type: 'component' });
  });
});

describe('exportPenpotComponent', () => {
  let exportPenpotComponent: typeof import('./penpot-client.js').exportPenpotComponent;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import('./penpot-client.js');
    exportPenpotComponent = mod.exportPenpotComponent;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns Buffer on successful export', async () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(imageBytes, { status: 200 }),
    );

    const result = await exportPenpotComponent('https://penpot.example.com', 'tok-123', 'file-1', 'comp-1');
    expect(result).toBeInstanceOf(Buffer);
    expect(result).not.toBeNull();
  });

  it('returns null on export failure (best-effort)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    );

    const result = await exportPenpotComponent('https://penpot.example.com', 'tok-123', 'file-1', 'comp-1');
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('comp-1'));

    warnSpy.mockRestore();
  });

  it('handles fetch rejection (network error)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await exportPenpotComponent('https://penpot.example.com', 'tok-123', 'file-1', 'comp-1');
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch'));

    warnSpy.mockRestore();
  });
});

describe('getPenpotFileComponents edge cases', () => {
  let getPenpotFileComponents: typeof import('./penpot-client.js').getPenpotFileComponents;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import('./penpot-client.js');
    getPenpotFileComponents = mod.getPenpotFileComponents;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles empty components map from get-file', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { components: {} } }), { status: 200 }),
    );

    const components = await getPenpotFileComponents('https://penpot.example.com', 'tok-123', 'file-1');
    expect(components).toEqual([]);
  });

  it('handles missing data.components key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );

    const components = await getPenpotFileComponents('https://penpot.example.com', 'tok-123', 'file-1');
    expect(components).toEqual([]);
  });
});

describe('penpotRpc edge cases', () => {
  let penpotRpc: typeof import('./penpot-client.js').penpotRpc;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import('./penpot-client.js');
    penpotRpc = mod.penpotRpc;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles fetch rejection (network timeout)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network timeout'));

    await expect(
      penpotRpc('https://penpot.example.com', 'get-profile', 'tok-123'),
    ).rejects.toThrow('network timeout');
  });
});
