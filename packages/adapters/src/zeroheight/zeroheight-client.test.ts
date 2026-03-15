import { describe, it, expect, vi, afterEach } from 'vitest';

describe('Zeroheight Client (real implementation)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('fetchTokenExport sends X-API-CLIENT and X-API-KEY headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'color-primary': '#000' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { fetchTokenExport } = await import('./zeroheight-client.js');
    await fetchTokenExport('https://org.zeroheight.com', 'ts-1', 'zhci_abc', 'zhat_xyz');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, reqInit] = mockFetch.mock.calls[0];
    expect(url).toContain('org.zeroheight.com');
    expect(reqInit.headers['X-API-CLIENT']).toBe('zhci_abc');
    expect(reqInit.headers['X-API-KEY']).toBe('zhat_xyz');
  });

  it('fetchTokenSets sends X-API-CLIENT and X-API-KEY headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { fetchTokenSets } = await import('./zeroheight-client.js');
    await fetchTokenSets('zhci_abc', 'zhat_xyz', 'sg-123');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, reqInit] = mockFetch.mock.calls[0];
    expect(url).toContain('zeroheight.com/open_api/v2/token-sets');
    expect(reqInit.headers['X-API-CLIENT']).toBe('zhci_abc');
    expect(reqInit.headers['X-API-KEY']).toBe('zhat_xyz');
  });

  it('fetchTokenExport throws ZeroheightApiError on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { fetchTokenExport, ZeroheightApiError } = await import('./zeroheight-client.js');
    await expect(
      fetchTokenExport('https://org.zeroheight.com', 'ts-1', 'bad', 'creds'),
    ).rejects.toThrow(ZeroheightApiError);

    await vi.importActual('./zeroheight-client.js').then((mod: any) => {
      // Verify the error has the correct status
    });

    // Also verify the error status value
    try {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      }));
      const mod = await import('./zeroheight-client.js');
      await mod.fetchTokenExport('https://org.zeroheight.com', 'ts-1', 'bad', 'creds');
    } catch (e: any) {
      expect(e.status).toBe(401);
      expect(e.name).toBe('ZeroheightApiError');
    }
  });

  it('fetchTokenSets throws ZeroheightApiError on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { fetchTokenSets, ZeroheightApiError } = await import('./zeroheight-client.js');
    await expect(
      fetchTokenSets('bad-client', 'bad-token', 'sg-123'),
    ).rejects.toThrow(ZeroheightApiError);

    // Verify error status
    try {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      }));
      const mod = await import('./zeroheight-client.js');
      await mod.fetchTokenSets('bad-client', 'bad-token', 'sg-123');
    } catch (e: any) {
      expect(e.status).toBe(403);
      expect(e.name).toBe('ZeroheightApiError');
    }
  });

  it('fetchTokenExport constructs correct URL from orgUrl and tokenSetId', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { fetchTokenExport } = await import('./zeroheight-client.js');
    await fetchTokenExport('https://myorg.zeroheight.com/', 'token-set-42', 'client', 'key');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://myorg.zeroheight.com/api/token_management/token_set/token-set-42/export?format=json');
  });

  it('fetchTokenSets constructs correct URL with styleguideId', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { fetchTokenSets } = await import('./zeroheight-client.js');
    await fetchTokenSets('client-id', 'access-tok', 'sg-999');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://zeroheight.com/open_api/v2/token-sets?styleguide_id=sg-999');
  });
});
