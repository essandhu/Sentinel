import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DesignSpec } from '@sentinel/types';
import {
  dispatchAdapters,
  compareTokenSpec,
  specsToRoutes,
} from './adapter-registry.js';

// Mock @sentinel/adapters at module level
vi.mock('@sentinel/adapters', () => ({
  ImageBaselineAdapter: vi.fn().mockImplementation(() => ({
    loadAll: vi.fn().mockResolvedValue([]),
  })),
  StorybookAdapter: vi.fn().mockImplementation(() => ({
    loadAll: vi.fn().mockResolvedValue([]),
  })),
  DesignTokenAdapter: vi.fn().mockImplementation(() => ({
    loadAll: vi.fn().mockResolvedValue([]),
  })),
  FigmaAdapter: vi.fn().mockImplementation(() => ({
    loadAll: vi.fn().mockResolvedValue([]),
  })),
  storybookStoryUrl: vi.fn(
    (url: string, id: string) =>
      `${url}/iframe.html?id=${id}&viewMode=story`,
  ),
}));

const makeStorybookSpec = (storyId: string, componentName?: string): DesignSpec => ({
  sourceType: 'storybook',
  metadata: {
    storyId,
    componentName,
    capturedAt: new Date().toISOString(),
  },
});

const makeImageSpec = (componentName: string): DesignSpec => ({
  sourceType: 'image',
  referenceImage: Buffer.from('fake-image'),
  metadata: { componentName },
});

const makeTokenSpec = (): DesignSpec => ({
  sourceType: 'tokens',
  tokens: {
    'color.primary': { type: 'color', value: '#0066cc' },
    'color.secondary': { type: 'color', value: '#ff5500' },
  },
  metadata: { capturedAt: new Date().toISOString() },
});

const makeFigmaSpec = (figmaNodeId: string): DesignSpec => ({
  sourceType: 'figma',
  referenceImage: Buffer.from('figma-image'),
  metadata: { figmaNodeId },
});

describe('dispatchAdapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty result when adapters is undefined', async () => {
    const result = await dispatchAdapters(undefined, {});
    expect(result).toEqual({ storybook: [], image: [], tokens: [], figma: [] });
  });

  it('returns empty result when adapters is empty array', async () => {
    const result = await dispatchAdapters([], {});
    expect(result).toEqual({ storybook: [], image: [], tokens: [], figma: [] });
  });

  it('calls StorybookAdapter.loadAll() and returns specs in result.storybook', async () => {
    const { StorybookAdapter } = await import('@sentinel/adapters');
    const mockSpecs = [makeStorybookSpec('button--primary', 'Button')];
    const mockLoadAll = vi.fn().mockResolvedValue(mockSpecs);
    vi.mocked(StorybookAdapter).mockImplementation(
      function () { return { loadAll: mockLoadAll }; } as any,
    );

    const result = await dispatchAdapters(
      [{ type: 'storybook', storybookUrl: 'http://localhost:6006' }],
      {},
    );

    expect(mockLoadAll).toHaveBeenCalledWith({
      storybookUrl: 'http://localhost:6006',
      storyIds: undefined,
    });
    expect(result.storybook).toEqual(mockSpecs);
    expect(result.image).toHaveLength(0);
  });

  it('calls ImageBaselineAdapter.loadAll() and returns specs in result.image', async () => {
    const { ImageBaselineAdapter } = await import('@sentinel/adapters');
    const mockSpecs = [makeImageSpec('components/Button')];
    const mockLoadAll = vi.fn().mockResolvedValue(mockSpecs);
    vi.mocked(ImageBaselineAdapter).mockImplementation(
      function () { return { loadAll: mockLoadAll }; } as any,
    );

    const result = await dispatchAdapters(
      [{ type: 'image', directory: './baselines' }],
      {},
    );

    expect(mockLoadAll).toHaveBeenCalledWith({ directory: './baselines' });
    expect(result.image).toEqual(mockSpecs);
    expect(result.storybook).toHaveLength(0);
  });

  it('calls DesignTokenAdapter.loadAll() and returns specs in result.tokens', async () => {
    const { DesignTokenAdapter } = await import('@sentinel/adapters');
    const mockSpecs = [makeTokenSpec()];
    const mockLoadAll = vi.fn().mockResolvedValue(mockSpecs);
    vi.mocked(DesignTokenAdapter).mockImplementation(
      function () { return { loadAll: mockLoadAll }; } as any,
    );

    const result = await dispatchAdapters(
      [
        {
          type: 'tokens',
          tokenFilePath: './tokens.json',
          targetUrl: 'http://localhost:3000',
        },
      ],
      {},
    );

    expect(mockLoadAll).toHaveBeenCalledWith({ tokenFilePath: './tokens.json' });
    expect(result.tokens).toEqual(mockSpecs);
  });

  it('calls FigmaAdapter.loadAll() with db/s3 deps and returns specs in result.figma', async () => {
    const { FigmaAdapter } = await import('@sentinel/adapters');
    const mockSpecs = [makeFigmaSpec('1:1')];
    const mockLoadAll = vi.fn().mockResolvedValue(mockSpecs);
    vi.mocked(FigmaAdapter).mockImplementation(
      function () { return { loadAll: mockLoadAll }; } as any,
    );

    const mockDb = {} as any;
    const mockS3 = {} as any;

    const result = await dispatchAdapters(
      [
        {
          type: 'figma',
          accessToken: 'secret',
          fileKey: 'abc123',
          nodeIds: ['1:1'],
          cacheBucket: 'my-bucket',
          dbConnectionString: 'postgres://localhost/sentinel',
        },
      ],
      { db: mockDb, storageClient: mockS3 },
    );

    expect(vi.mocked(FigmaAdapter)).toHaveBeenCalled();
    expect(mockLoadAll).toHaveBeenCalled();
    expect(result.figma).toEqual(mockSpecs);
  });
});

describe('specsToRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('converts storybook specs to routes using storybookStoryUrl()', async () => {
    const { storybookStoryUrl } = await import('@sentinel/adapters');
    vi.mocked(storybookStoryUrl).mockImplementation(
      (url, id) => `${url}/iframe.html?id=${id}&viewMode=story`,
    );

    const spec = makeStorybookSpec('button--primary', 'Button');
    const adapterConfig = {
      type: 'storybook' as const,
      storybookUrl: 'http://localhost:6006',
    };

    const { routes } = specsToRoutes({ storybook: [spec], image: [], tokens: [], figma: [] }, [
      adapterConfig,
    ]);

    expect(routes).toHaveLength(1);
    expect(routes[0].name).toBe('Button');
    expect(routes[0].path).toBe(
      'http://localhost:6006/iframe.html?id=button--primary&viewMode=story',
    );
    expect(storybookStoryUrl).toHaveBeenCalledWith(
      'http://localhost:6006',
      'button--primary',
    );
  });

  it('uses storyId as route name when componentName is absent', async () => {
    const spec = makeStorybookSpec('button--primary');
    const adapterConfig = {
      type: 'storybook' as const,
      storybookUrl: 'http://localhost:6006',
    };

    const { routes } = specsToRoutes({ storybook: [spec], image: [], tokens: [], figma: [] }, [
      adapterConfig,
    ]);

    expect(routes[0].name).toBe('button--primary');
  });

  it('image specs produce no routes (they are baselines only)', () => {
    const spec = makeImageSpec('components/Button');
    const { routes, baselineSpecs } = specsToRoutes(
      { storybook: [], image: [spec], tokens: [], figma: [] },
      [],
    );

    expect(routes).toHaveLength(0);
    expect(baselineSpecs).toHaveLength(1);
    expect(baselineSpecs[0]).toBe(spec);
  });

  it('figma specs produce no routes (they are baselines only)', () => {
    const spec = makeFigmaSpec('1:1');
    const { routes, baselineSpecs } = specsToRoutes(
      { storybook: [], image: [], tokens: [], figma: [spec] },
      [],
    );

    expect(routes).toHaveLength(0);
    expect(baselineSpecs).toHaveLength(1);
    expect(baselineSpecs[0]).toBe(spec);
  });
});

describe('compareTokenSpec', () => {
  it('returns violations when CSS custom property mismatches token value', async () => {
    const spec = makeTokenSpec();
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockImplementation((fn: unknown, varName: string) => {
        if (varName === '--color-primary') return Promise.resolve('#ff0000');
        if (varName === '--color-secondary') return Promise.resolve('#ff5500');
        return Promise.resolve('');
      }),
    };

    const { compareTokenSpec } = await import('./adapter-registry.js');
    const violations = await compareTokenSpec(
      mockPage as any,
      spec,
      'http://localhost:3000',
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      tokenName: 'color.primary',
      expectedValue: '#0066cc',
      actualValue: '#ff0000',
      elementSelector: ':root',
    });
  });

  it('returns empty array when CSS custom property matches token value', async () => {
    const spec = makeTokenSpec();
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockImplementation((fn: unknown, varName: string) => {
        if (varName === '--color-primary') return Promise.resolve('#0066cc');
        if (varName === '--color-secondary') return Promise.resolve('#ff5500');
        return Promise.resolve('');
      }),
    };

    const { compareTokenSpec } = await import('./adapter-registry.js');
    const violations = await compareTokenSpec(
      mockPage as any,
      spec,
      'http://localhost:3000',
    );

    expect(violations).toHaveLength(0);
  });

  it('skips tokens where CSS variable is not found on :root (no violation for missing vars)', async () => {
    const spec = makeTokenSpec();
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(''), // Empty string = not found
    };

    const { compareTokenSpec } = await import('./adapter-registry.js');
    const violations = await compareTokenSpec(
      mockPage as any,
      spec,
      'http://localhost:3000',
    );

    expect(violations).toHaveLength(0);
  });

  it('calls page.goto with targetUrl before evaluating CSS', async () => {
    const spec = makeTokenSpec();
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(''),
    };

    const { compareTokenSpec } = await import('./adapter-registry.js');
    await compareTokenSpec(mockPage as any, spec, 'http://localhost:3000/tokens');

    expect(mockPage.goto).toHaveBeenCalledWith('http://localhost:3000/tokens', {
      waitUntil: 'domcontentloaded',
    });
  });
});
