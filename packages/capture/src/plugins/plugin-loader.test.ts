import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdir } from 'node:fs/promises';
import type { SentinelPlugin } from '@sentinel/types';

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
}));

const mockedReaddir = vi.mocked(readdir);

// We need to dynamically import the module under test after mocking
let discoverPlugins: typeof import('./plugin-loader.js').discoverPlugins;
let loadPlugin: typeof import('./plugin-loader.js').loadPlugin;
let loadAllPlugins: typeof import('./plugin-loader.js').loadAllPlugins;

beforeEach(async () => {
  vi.resetModules();
  vi.restoreAllMocks();

  // Re-mock readdir after resetModules
  vi.mock('node:fs/promises', () => ({
    readdir: vi.fn(),
  }));

  const mod = await import('./plugin-loader.js');
  discoverPlugins = mod.discoverPlugins;
  loadPlugin = mod.loadPlugin;
  loadAllPlugins = mod.loadAllPlugins;
});

describe('discoverPlugins', () => {
  it('returns sentinel-plugin-* packages from node_modules', async () => {
    const { readdir: rd } = await import('node:fs/promises');
    vi.mocked(rd).mockResolvedValue([
      'express',
      'sentinel-plugin-foo',
      'lodash',
      'sentinel-plugin-bar',
      '@types',
    ] as unknown as Awaited<ReturnType<typeof readdir>>);

    const result = await discoverPlugins('/project');
    expect(result).toEqual(['sentinel-plugin-foo', 'sentinel-plugin-bar']);
  });

  it('returns empty array when node_modules does not exist', async () => {
    const { readdir: rd } = await import('node:fs/promises');
    vi.mocked(rd).mockRejectedValue(new Error('ENOENT'));

    const result = await discoverPlugins('/project');
    expect(result).toEqual([]);
  });
});

describe('loadPlugin', () => {
  it('throws if loaded module has no name or version', async () => {
    vi.doMock('sentinel-plugin-bad', () => ({ default: { foo: 'bar' } }), { virtual: true });
    await expect(loadPlugin('sentinel-plugin-bad', undefined)).rejects.toThrow(
      'missing required name/version',
    );
    vi.doUnmock('sentinel-plugin-bad');
  });

  it('returns LoadedPlugin with valid plugin', async () => {
    const mockPlugin: SentinelPlugin = {
      name: 'test-plugin',
      version: '1.0.0',
    };
    vi.doMock('sentinel-plugin-valid', () => ({ default: mockPlugin }), { virtual: true });

    const result = await loadPlugin('sentinel-plugin-valid', { key: 'value' });
    expect(result.plugin.name).toBe('test-plugin');
    expect(result.packageName).toBe('sentinel-plugin-valid');
    expect(result.config).toEqual({ key: 'value' });
    vi.doUnmock('sentinel-plugin-valid');
  });

  it('validates config against plugin configSchema if both exist', async () => {
    const { z } = await import('zod');
    const schema = z.object({ url: z.string().url() });
    const mockPlugin: SentinelPlugin = {
      name: 'schema-plugin',
      version: '1.0.0',
      configSchema: schema,
    };
    vi.doMock('sentinel-plugin-schema', () => ({ default: mockPlugin }), { virtual: true });

    // Valid config passes
    const result = await loadPlugin('sentinel-plugin-schema', { url: 'https://example.com' });
    expect(result.plugin.name).toBe('schema-plugin');

    vi.doUnmock('sentinel-plugin-schema');
  });

  it('throws on invalid config when configSchema exists', async () => {
    const { z } = await import('zod');
    const schema = z.object({ url: z.string().url() });
    const mockPlugin: SentinelPlugin = {
      name: 'schema-plugin2',
      version: '1.0.0',
      configSchema: schema,
    };
    vi.doMock('sentinel-plugin-schema2', () => ({ default: mockPlugin }), { virtual: true });

    await expect(loadPlugin('sentinel-plugin-schema2', { url: 'not-a-url' })).rejects.toThrow();
    vi.doUnmock('sentinel-plugin-schema2');
  });

  it('calls initialize when present', async () => {
    const initFn = vi.fn().mockResolvedValue(undefined);
    const mockPlugin: SentinelPlugin = {
      name: 'init-plugin',
      version: '1.0.0',
      initialize: initFn,
    };
    vi.doMock('sentinel-plugin-init', () => ({ default: mockPlugin }), { virtual: true });

    await loadPlugin('sentinel-plugin-init', { some: 'config' });
    expect(initFn).toHaveBeenCalledWith({ some: 'config' });
    vi.doUnmock('sentinel-plugin-init');
  });

  it('supports module-level export (no default)', async () => {
    vi.doMock(
      'sentinel-plugin-named',
      () => ({
        default: undefined,
        name: 'named-plugin',
        version: '2.0.0',
        configSchema: undefined,
        initialize: undefined,
      }),
      { virtual: true },
    );

    const result = await loadPlugin('sentinel-plugin-named', undefined);
    expect(result.plugin.name).toBe('named-plugin');
    vi.doUnmock('sentinel-plugin-named');
  });
});

describe('loadAllPlugins', () => {
  it('skips disabled plugins', async () => {
    const { readdir: rd } = await import('node:fs/promises');
    vi.mocked(rd).mockResolvedValue([
      'sentinel-plugin-enabled',
      'sentinel-plugin-disabled',
    ] as unknown as Awaited<ReturnType<typeof readdir>>);

    const enabledPlugin: SentinelPlugin = { name: 'enabled', version: '1.0.0' };
    const disabledPlugin: SentinelPlugin = { name: 'disabled', version: '1.0.0' };
    vi.doMock('sentinel-plugin-enabled', () => ({ default: enabledPlugin }), { virtual: true });
    vi.doMock('sentinel-plugin-disabled', () => ({ default: disabledPlugin }), { virtual: true });

    const result = await loadAllPlugins('/project', {
      'sentinel-plugin-enabled': { enabled: true },
      'sentinel-plugin-disabled': { enabled: false },
    });

    expect(result).toHaveLength(1);
    expect(result[0].plugin.name).toBe('enabled');

    vi.doUnmock('sentinel-plugin-enabled');
    vi.doUnmock('sentinel-plugin-disabled');
  });

  it('continues loading when individual plugin fails', async () => {
    const { readdir: rd } = await import('node:fs/promises');
    vi.mocked(rd).mockResolvedValue([
      'sentinel-plugin-good',
      'sentinel-plugin-bad',
    ] as unknown as Awaited<ReturnType<typeof readdir>>);

    const goodPlugin: SentinelPlugin = { name: 'good', version: '1.0.0' };
    vi.doMock('sentinel-plugin-good', () => ({ default: goodPlugin }), { virtual: true });
    vi.doMock('sentinel-plugin-bad', () => ({ default: {} }), { virtual: true });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await loadAllPlugins('/project', {
      'sentinel-plugin-good': { enabled: true },
      'sentinel-plugin-bad': { enabled: true },
    });

    expect(result).toHaveLength(1);
    expect(result[0].plugin.name).toBe('good');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    vi.doUnmock('sentinel-plugin-good');
    vi.doUnmock('sentinel-plugin-bad');
  });
});
