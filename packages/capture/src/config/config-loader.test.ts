import { describe, it, expect, afterEach } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ZodError } from 'zod';
import { loadConfig, parseConfig, resolveThresholds, parseViewport } from './config-loader.js';
import { SentinelConfigSchema } from './config-schema.js';

const tmpFile = (name: string) => join(tmpdir(), `sentinel-test-${name}-${Date.now()}.yml`);

describe('parseConfig', () => {
  it('parses a raw config object through the schema', () => {
    const raw = {
      project: 'test-project',
      baseUrl: 'http://localhost:3000',
      capture: {
        routes: [{ path: '/', name: 'home' }],
        viewports: ['1280x720'],
      },
    };
    const result = parseConfig(raw);
    expect(result.project).toBe('test-project');
    expect(result.capture.routes).toHaveLength(1);
  });

  it('throws on invalid config', () => {
    expect(() => parseConfig({ project: '' })).toThrow();
  });
});

describe('loadConfig', () => {
  const files: string[] = [];

  afterEach(async () => {
    await Promise.all(files.map((f) => rm(f, { force: true })));
    files.length = 0;
  });

  it('parses a valid YAML config into a typed SentinelConfigParsed object', async () => {
    const path = tmpFile('valid');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
baseUrl: http://localhost:3000
capture:
  routes:
    - path: /
      name: home
  viewports:
    - 1280x720
thresholds:
  pixelDiffPercent: 0.5
  ssimMin: 0.9
`.trim(),
    );

    const config = await loadConfig(path);

    expect(config.project).toBe('My App');
    expect(config.baseUrl).toBe('http://localhost:3000');
    expect(config.capture.routes).toHaveLength(1);
    expect(config.capture.routes[0].path).toBe('/');
    expect(config.capture.routes[0].name).toBe('home');
    expect(config.capture.viewports).toEqual(['1280x720']);
    expect(config.thresholds?.pixelDiffPercent).toBe(0.5);
    expect(config.thresholds?.ssimMin).toBe(0.9);
  });

  it('applies default viewports ["1280x720"] when viewports omitted', async () => {
    const path = tmpFile('defaults');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
baseUrl: http://localhost:3000
capture:
  routes:
    - path: /
      name: home
`.trim(),
    );

    const config = await loadConfig(path);
    expect(config.capture.viewports).toEqual(['1280x720']);
  });

  it('throws ZodError when baseUrl is missing', async () => {
    const path = tmpFile('no-baseurl');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
capture:
  routes:
    - path: /
      name: home
`.trim(),
    );

    await expect(loadConfig(path)).rejects.toThrow(ZodError);
  });

  it('throws ZodError when project is missing', async () => {
    const path = tmpFile('no-project');
    files.push(path);
    await writeFile(
      path,
      `
baseUrl: http://localhost:3000
capture:
  routes:
    - path: /
      name: home
`.trim(),
    );

    await expect(loadConfig(path)).rejects.toThrow(ZodError);
  });

  it('throws ZodError when routes array is empty and no adapters configured', async () => {
    const path = tmpFile('empty-routes');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
baseUrl: http://localhost:3000
capture:
  routes: []
`.trim(),
    );

    await expect(loadConfig(path)).rejects.toThrow(ZodError);
  });

  it('parses config with storybook adapter + routes successfully', async () => {
    const path = tmpFile('storybook-adapter');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
baseUrl: http://localhost:3000
capture:
  routes:
    - path: /
      name: home
adapters:
  - type: storybook
    storybookUrl: http://localhost:6006
    storyIds:
      - button--primary
`.trim(),
    );

    const config = await loadConfig(path);
    expect(config.adapters).toHaveLength(1);
    expect(config.adapters![0].type).toBe('storybook');
  });

  it('parses adapter-only config (image adapter, no routes) successfully', async () => {
    const path = tmpFile('image-adapter-only');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
baseUrl: http://localhost:3000
capture:
  routes: []
adapters:
  - type: image
    directory: ./baselines
`.trim(),
    );

    const config = await loadConfig(path);
    expect(config.adapters).toHaveLength(1);
    expect(config.adapters![0].type).toBe('image');
    expect(config.capture.routes).toHaveLength(0);
  });

  it('parses tokens adapter with targetUrl successfully', async () => {
    const path = tmpFile('tokens-adapter');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
baseUrl: http://localhost:3000
capture:
  routes: []
adapters:
  - type: tokens
    tokenFilePath: ./tokens.json
    targetUrl: http://localhost:3000/design-tokens
`.trim(),
    );

    const config = await loadConfig(path);
    expect(config.adapters).toHaveLength(1);
    const tokensAdapter = config.adapters![0];
    expect(tokensAdapter.type).toBe('tokens');
    if (tokensAdapter.type === 'tokens') {
      expect(tokensAdapter.targetUrl).toBe('http://localhost:3000/design-tokens');
    }
  });

  it('parses figma adapter config successfully', async () => {
    const path = tmpFile('figma-adapter');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
baseUrl: http://localhost:3000
capture:
  routes: []
adapters:
  - type: figma
    accessToken: secret-token
    fileKey: abc123
    nodeIds:
      - "1:1"
    cacheBucket: my-bucket
    dbConnectionString: postgres://localhost/sentinel
`.trim(),
    );

    const config = await loadConfig(path);
    expect(config.adapters).toHaveLength(1);
    expect(config.adapters![0].type).toBe('figma');
  });

  it('throws ZodError when both routes and adapters are absent', async () => {
    const path = tmpFile('no-routes-no-adapters');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
baseUrl: http://localhost:3000
capture:
  routes: []
`.trim(),
    );

    await expect(loadConfig(path)).rejects.toThrow(ZodError);
  });

  it('throws ZodError for invalid adapter type', async () => {
    const path = tmpFile('bad-adapter-type');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
baseUrl: http://localhost:3000
capture:
  routes:
    - path: /
      name: home
adapters:
  - type: unknown-adapter
    someField: value
`.trim(),
    );

    await expect(loadConfig(path)).rejects.toThrow(ZodError);
  });

  it('throws ZodError for invalid viewport format', async () => {
    const path = tmpFile('bad-viewport');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
baseUrl: http://localhost:3000
capture:
  routes:
    - path: /
      name: home
  viewports:
    - bad
`.trim(),
    );

    await expect(loadConfig(path)).rejects.toThrow(ZodError);
  });

  it('throws ZodError when pixelDiffPercent is out of range (> 100)', async () => {
    const path = tmpFile('bad-threshold');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
baseUrl: http://localhost:3000
capture:
  routes:
    - path: /
      name: home
thresholds:
  pixelDiffPercent: 150
`.trim(),
    );

    await expect(loadConfig(path)).rejects.toThrow(ZodError);
  });

  it('throws ZodError when ssimMin is out of range (> 1)', async () => {
    const path = tmpFile('bad-ssim');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
baseUrl: http://localhost:3000
capture:
  routes:
    - path: /
      name: home
thresholds:
  ssimMin: 1.5
`.trim(),
    );

    await expect(loadConfig(path)).rejects.toThrow(ZodError);
  });

  it('throws Error for non-existent file path', async () => {
    await expect(loadConfig('/tmp/does-not-exist-sentinel.yml')).rejects.toThrow();
  });

  it('accepts per-route threshold and viewports overrides', async () => {
    const path = tmpFile('route-overrides');
    files.push(path);
    await writeFile(
      path,
      `
project: My App
baseUrl: http://localhost:3000
capture:
  routes:
    - path: /dashboard
      name: dashboard
      viewports:
        - 1920x1080
      thresholds:
        pixelDiffPercent: 2
  viewports:
    - 1280x720
`.trim(),
    );

    const config = await loadConfig(path);
    expect(config.capture.routes[0].viewports).toEqual(['1920x1080']);
    expect(config.capture.routes[0].thresholds?.pixelDiffPercent).toBe(2);
  });
});

describe('browsers config schema', () => {
  const baseConfig = {
    project: 'test',
    baseUrl: 'http://localhost:3000',
    capture: { routes: [{ path: '/', name: 'home' }] },
  };

  it('parses config with browsers: [chromium, firefox, webkit] successfully', () => {
    const result = SentinelConfigSchema.parse({ ...baseConfig, browsers: ['chromium', 'firefox', 'webkit'] });
    expect(result.browsers).toEqual(['chromium', 'firefox', 'webkit']);
  });

  it('parses config with browsers: [chromium] (single browser)', () => {
    const result = SentinelConfigSchema.parse({ ...baseConfig, browsers: ['chromium'] });
    expect(result.browsers).toEqual(['chromium']);
  });

  it('defaults to [chromium] when browsers field is omitted', () => {
    const result = SentinelConfigSchema.parse(baseConfig);
    expect(result.browsers).toEqual(['chromium']);
  });

  it('throws ZodError for invalid browser name (e.g. safari)', () => {
    expect(() =>
      SentinelConfigSchema.parse({ ...baseConfig, browsers: ['safari'] }),
    ).toThrow(ZodError);
  });

  it('parses config with browserThresholds: { webkit: { pixelDiffPercent: 0.5 } } successfully', () => {
    const result = SentinelConfigSchema.parse({
      ...baseConfig,
      browserThresholds: { webkit: { pixelDiffPercent: 0.5 } },
    });
    expect(result.browserThresholds?.webkit?.pixelDiffPercent).toBe(0.5);
  });
});

describe('resolveThresholds', () => {
  it('returns per-route thresholds when both route and global are set', () => {
    const result = resolveThresholds(
      { thresholds: { pixelDiffPercent: 5, ssimMin: 0.8 } },
      undefined,
      undefined,
      undefined,
      { pixelDiffPercent: 1, ssimMin: 0.99 },
    );
    expect(result).toEqual({ pixelDiffPercent: 5, ssimMin: 0.8 });
  });

  it('returns global thresholds when per-route thresholds are not set', () => {
    const result = resolveThresholds(
      {},
      undefined,
      undefined,
      undefined,
      { pixelDiffPercent: 1, ssimMin: 0.99 },
    );
    expect(result).toEqual({ pixelDiffPercent: 1, ssimMin: 0.99 });
  });

  it('returns route thresholds when global is not set', () => {
    const result = resolveThresholds(
      { thresholds: { pixelDiffPercent: 3, ssimMin: 0.85 } },
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(result).toEqual({ pixelDiffPercent: 3, ssimMin: 0.85 });
  });

  it('returns defaults { pixelDiffPercent: 0.1, ssimMin: 0.95 } when neither is set', () => {
    const result = resolveThresholds({}, undefined, undefined, undefined, undefined);
    expect(result).toEqual({ pixelDiffPercent: 0.1, ssimMin: 0.95 });
  });

  it('partially merges: uses route pixelDiffPercent + global ssimMin when route only has pixelDiffPercent', () => {
    const result = resolveThresholds(
      { thresholds: { pixelDiffPercent: 2.5 } },
      undefined,
      undefined,
      undefined,
      { pixelDiffPercent: 1, ssimMin: 0.97 },
    );
    expect(result).toEqual({ pixelDiffPercent: 2.5, ssimMin: 0.97 });
  });

  it('partially merges: uses global pixelDiffPercent + route ssimMin when route only has ssimMin', () => {
    const result = resolveThresholds(
      { thresholds: { ssimMin: 0.88 } },
      undefined,
      undefined,
      undefined,
      { pixelDiffPercent: 1.5, ssimMin: 0.99 },
    );
    expect(result).toEqual({ pixelDiffPercent: 1.5, ssimMin: 0.88 });
  });

  it('falls back to defaults for fields missing from both route and global', () => {
    const result = resolveThresholds(
      { thresholds: { pixelDiffPercent: 3 } },
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(result).toEqual({ pixelDiffPercent: 3, ssimMin: 0.95 });
  });

  it('returns browser threshold when route threshold is not set', () => {
    const result = resolveThresholds(
      {},
      undefined,
      { webkit: { pixelDiffPercent: 0.5, ssimMin: 0.90 } },
      'webkit',
      { pixelDiffPercent: 0.1, ssimMin: 0.95 },
    );
    expect(result).toEqual({ pixelDiffPercent: 0.5, ssimMin: 0.90 });
  });

  it('uses four-level precedence: route > browser > global > defaults', () => {
    // Route has pixelDiffPercent, browser has ssimMin, global has both
    const result = resolveThresholds(
      { thresholds: { pixelDiffPercent: 10 } },
      undefined,
      { firefox: { ssimMin: 0.80 } },
      'firefox',
      { pixelDiffPercent: 1, ssimMin: 0.99 },
    );
    // pixelDiffPercent: route (10) wins over browser (undefined) and global (1)
    // ssimMin: route (undefined) -> browser (0.80) wins over global (0.99)
    expect(result).toEqual({ pixelDiffPercent: 10, ssimMin: 0.80 });
  });

  it('preserves existing two-level behavior when browser params are omitted', () => {
    const result = resolveThresholds(
      { thresholds: { pixelDiffPercent: 5 } },
      undefined,
      undefined,
      undefined,
      { pixelDiffPercent: 1, ssimMin: 0.99 },
    );
    expect(result).toEqual({ pixelDiffPercent: 5, ssimMin: 0.99 });
  });
});

describe('resolveThresholds with breakpoint layer', () => {
  it('uses breakpoint values when route has no override', () => {
    const result = resolveThresholds(
      {},
      { pixelDiffPercent: 2.0, ssimMin: 0.90 },
      undefined,
      undefined,
      { pixelDiffPercent: 0.5, ssimMin: 0.97 },
    );
    expect(result).toEqual({ pixelDiffPercent: 2.0, ssimMin: 0.90 });
  });

  it('route thresholds still take precedence over breakpoint thresholds', () => {
    const result = resolveThresholds(
      { thresholds: { pixelDiffPercent: 10, ssimMin: 0.80 } },
      { pixelDiffPercent: 2.0, ssimMin: 0.90 },
      undefined,
      undefined,
      undefined,
    );
    expect(result).toEqual({ pixelDiffPercent: 10, ssimMin: 0.80 });
  });

  it('breakpoint thresholds take precedence over browser thresholds', () => {
    const result = resolveThresholds(
      {},
      { pixelDiffPercent: 3.0, ssimMin: 0.88 },
      { webkit: { pixelDiffPercent: 1.0, ssimMin: 0.95 } },
      'webkit',
      undefined,
    );
    expect(result).toEqual({ pixelDiffPercent: 3.0, ssimMin: 0.88 });
  });

  it('breakpoint thresholds take precedence over global thresholds', () => {
    const result = resolveThresholds(
      {},
      { pixelDiffPercent: 5.0, ssimMin: 0.85 },
      undefined,
      undefined,
      { pixelDiffPercent: 1.0, ssimMin: 0.99 },
    );
    expect(result).toEqual({ pixelDiffPercent: 5.0, ssimMin: 0.85 });
  });

  it('null/undefined breakpointThresholds falls through to browser layer (backward compatible)', () => {
    const result = resolveThresholds(
      {},
      undefined,
      { firefox: { pixelDiffPercent: 0.8, ssimMin: 0.92 } },
      'firefox',
      { pixelDiffPercent: 0.5, ssimMin: 0.97 },
    );
    expect(result).toEqual({ pixelDiffPercent: 0.8, ssimMin: 0.92 });
  });

  it('partial breakpoint thresholds (only pixelDiffPercent set) falls through for ssimMin', () => {
    const result = resolveThresholds(
      {},
      { pixelDiffPercent: 4.0 },
      { webkit: { ssimMin: 0.91 } },
      'webkit',
      { pixelDiffPercent: 1.0, ssimMin: 0.99 },
    );
    // pixelDiffPercent: breakpoint (4.0) wins
    // ssimMin: breakpoint (undefined) -> browser webkit (0.91) wins
    expect(result).toEqual({ pixelDiffPercent: 4.0, ssimMin: 0.91 });
  });
});

describe('suite and testPlan config schema', () => {
  const baseConfig = {
    project: 'test',
    baseUrl: 'http://localhost:3000',
    capture: {
      routes: [
        { path: '/', name: 'home' },
        { path: '/login', name: 'login' },
        { path: '/dashboard', name: 'dashboard' },
      ],
    },
  };

  it('accepts SuiteSchema with routes array', () => {
    const result = SentinelConfigSchema.parse({
      ...baseConfig,
      suites: { smoke: { routes: ['/', '/login'] } },
    });
    expect(result.suites?.smoke.routes).toEqual(['/', '/login']);
  });

  it('accepts config with suites section mapping suite names to route lists', () => {
    const result = SentinelConfigSchema.parse({
      ...baseConfig,
      suites: {
        smoke: { routes: ['/', '/login'] },
        full: { routes: ['/', '/login', '/dashboard'] },
      },
    });
    expect(Object.keys(result.suites!)).toEqual(['smoke', 'full']);
  });

  it('accepts config with testPlans section mapping plan names to ordered step lists', () => {
    const result = SentinelConfigSchema.parse({
      ...baseConfig,
      suites: { smoke: { routes: ['/'] } },
      testPlans: {
        release: { steps: [{ suite: 'smoke' }] },
      },
    });
    expect(result.testPlans?.release.steps).toHaveLength(1);
    expect(result.testPlans?.release.steps[0].suite).toBe('smoke');
  });

  it('rejects suite referencing route path not in capture.routes', () => {
    expect(() =>
      SentinelConfigSchema.parse({
        ...baseConfig,
        suites: { smoke: { routes: ['/', '/nonexistent'] } },
      }),
    ).toThrow(ZodError);
  });

  it('rejects testPlan referencing suite name not in suites', () => {
    expect(() =>
      SentinelConfigSchema.parse({
        ...baseConfig,
        suites: { smoke: { routes: ['/'] } },
        testPlans: {
          release: { steps: [{ suite: 'nonexistent' }] },
        },
      }),
    ).toThrow(ZodError);
  });

  it('treats suites and testPlans as optional (existing configs still valid)', () => {
    const result = SentinelConfigSchema.parse(baseConfig);
    expect(result.suites).toBeUndefined();
    expect(result.testPlans).toBeUndefined();
  });
});

describe('boundaryTesting config schema', () => {
  const baseConfig = {
    project: 'test',
    baseUrl: 'http://localhost:3000',
    capture: {
      routes: [
        { path: '/', name: 'home' },
        { path: '/login', name: 'login' },
      ],
    },
  };

  it('parses config with boundaryTesting: { enabled: true } successfully', () => {
    const result = SentinelConfigSchema.parse({
      ...baseConfig,
      boundaryTesting: { enabled: true },
    });
    expect(result.boundaryTesting?.enabled).toBe(true);
    expect(result.boundaryTesting?.mode).toBe('below'); // default
  });

  it('parses config with boundaryTesting: { enabled: true, mode: both } successfully', () => {
    const result = SentinelConfigSchema.parse({
      ...baseConfig,
      boundaryTesting: { enabled: true, mode: 'both' },
    });
    expect(result.boundaryTesting?.enabled).toBe(true);
    expect(result.boundaryTesting?.mode).toBe('both');
  });

  it('parses suite with boundaryTesting: false override successfully', () => {
    const result = SentinelConfigSchema.parse({
      ...baseConfig,
      suites: {
        smoke: { routes: ['/'], boundaryTesting: false },
      },
    });
    expect(result.suites?.smoke.boundaryTesting).toBe(false);
  });

  it('config with no boundaryTesting field still parses (defaults to disabled)', () => {
    const result = SentinelConfigSchema.parse(baseConfig);
    expect(result.boundaryTesting).toBeUndefined();
  });
});

describe('parseViewport', () => {
  it('parses "1280x720" into { width: 1280, height: 720 }', () => {
    expect(parseViewport('1280x720')).toEqual({ width: 1280, height: 720 });
  });

  it('parses "1920x1080" into { width: 1920, height: 1080 }', () => {
    expect(parseViewport('1920x1080')).toEqual({ width: 1920, height: 1080 });
  });

  it('parses "375x667" (mobile) into { width: 375, height: 667 }', () => {
    expect(parseViewport('375x667')).toEqual({ width: 375, height: 667 });
  });
});
