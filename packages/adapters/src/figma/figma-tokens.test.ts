import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractDesignTokens, FigmaApiError, rgbaToHex } from './figma-tokens.js';

describe('rgbaToHex', () => {
  it('converts pure red (1, 0, 0) to #ff0000', () => {
    expect(rgbaToHex(1, 0, 0)).toBe('#ff0000');
  });

  it('converts mid-grey (0.5, 0.5, 0.5) to #808080', () => {
    expect(rgbaToHex(0.5, 0.5, 0.5)).toBe('#808080');
  });

  it('converts pure white (1, 1, 1) to #ffffff', () => {
    expect(rgbaToHex(1, 1, 1)).toBe('#ffffff');
  });

  it('converts pure black (0, 0, 0) to #000000', () => {
    expect(rgbaToHex(0, 0, 0)).toBe('#000000');
  });
});

describe('extractDesignTokens', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses Variables API when it returns 200', async () => {
    const variablesResponse = {
      meta: {
        variableCollections: {
          'col-1': {
            id: 'col-1',
            name: 'Design Tokens',
            defaultModeId: 'mode-1',
            modes: [{ modeId: 'mode-1', name: 'Default' }],
          },
        },
        variables: {
          'var-1': {
            id: 'var-1',
            name: 'primary-color',
            resolvedType: 'COLOR',
            variableCollectionId: 'col-1',
            valuesByMode: {
              'mode-1': { r: 1, g: 0, b: 0, a: 1 },
            },
          },
          'var-2': {
            id: 'var-2',
            name: 'spacing-sm',
            resolvedType: 'FLOAT',
            variableCollectionId: 'col-1',
            valuesByMode: {
              'mode-1': 8,
            },
          },
        },
      },
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(variablesResponse), { status: 200 }),
    );

    const tokens = await extractDesignTokens('file-key', 'tok-123');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain('/v1/files/file-key/variables/local');

    expect(tokens['primary-color']).toEqual({ type: 'color', value: '#ff0000' });
    expect(tokens['spacing-sm']).toEqual({ type: 'number', value: 8 });
  });

  it('falls back to styles extraction when Variables API returns 403', async () => {
    // Variables API returns 403 (non-Enterprise)
    fetchSpy.mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    // Step 1: GET /v1/files/:key for styles metadata
    const fileResponse = {
      styles: {
        'node-1:1': { key: 'style-1', name: 'Brand Red', styleType: 'FILL' },
        'node-2:2': { key: 'style-2', name: 'Heading', styleType: 'TEXT' },
      },
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(fileResponse), { status: 200 }),
    );

    // Step 2: GET /v1/files/:key/nodes?ids=...
    const nodesResponse = {
      nodes: {
        'node-1:1': {
          document: {
            fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 } }],
          },
        },
        'node-2:2': {
          document: {
            style: { fontFamily: 'Inter', fontSize: 24 },
          },
        },
      },
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(nodesResponse), { status: 200 }),
    );

    const tokens = await extractDesignTokens('file-key', 'tok-123');

    // Should have made 3 calls: variables (403), file metadata, node details
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // Verify the two-step URLs
    const [url2] = fetchSpy.mock.calls[1] as [string];
    expect(url2).toContain('/v1/files/file-key');
    const [url3] = fetchSpy.mock.calls[2] as [string];
    expect(url3).toContain('/v1/files/file-key/nodes');
  });

  it('styles extraction: FILL style extracted as color hex token', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    const fileResponse = {
      styles: {
        'node-1:1': { key: 'style-1', name: 'Brand Blue', styleType: 'FILL' },
      },
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(fileResponse), { status: 200 }),
    );

    const nodesResponse = {
      nodes: {
        'node-1:1': {
          document: {
            fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 } }],
          },
        },
      },
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(nodesResponse), { status: 200 }),
    );

    const tokens = await extractDesignTokens('file-key', 'tok-123');
    expect(tokens['Brand Blue']).toEqual({ type: 'color', value: '#0000ff' });
  });

  it('styles extraction: TEXT style extracted as font-family and font-size tokens', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    const fileResponse = {
      styles: {
        'node-2:2': { key: 'style-2', name: 'Heading', styleType: 'TEXT' },
      },
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(fileResponse), { status: 200 }),
    );

    const nodesResponse = {
      nodes: {
        'node-2:2': {
          document: {
            style: { fontFamily: 'Inter', fontSize: 24 },
          },
        },
      },
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(nodesResponse), { status: 200 }),
    );

    const tokens = await extractDesignTokens('file-key', 'tok-123');
    expect(tokens['Heading/font-family']).toEqual({ type: 'font-family', value: 'Inter' });
    expect(tokens['Heading/font-size']).toEqual({ type: 'font-size', value: 24 });
  });

  it('returns empty object when file has no styles', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    const fileResponse = { styles: {} };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(fileResponse), { status: 200 }),
    );

    const tokens = await extractDesignTokens('file-key', 'tok-123');
    expect(tokens).toEqual({});
  });

  it('re-throws non-403/404 errors from Variables API (e.g., 500)', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('Server Error', { status: 500 }),
    );

    await expect(extractDesignTokens('file-key', 'tok-123')).rejects.toThrow(FigmaApiError);

    fetchSpy.mockResolvedValueOnce(
      new Response('Server Error', { status: 500 }),
    );

    await expect(
      extractDesignTokens('file-key', 'tok-123'),
    ).rejects.toThrow(/500/);
  });

  it('falls back to styles extraction when Variables API returns 404', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const fileResponse = { styles: {} };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(fileResponse), { status: 200 }),
    );

    const tokens = await extractDesignTokens('file-key', 'tok-123');
    expect(tokens).toEqual({});
  });
});
