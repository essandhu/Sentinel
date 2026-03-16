import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  ViewportSchema,
  ThresholdSchema,
  ParameterDimensionSchema,
  MaskStrategySchema,
  MaskRuleSchema,
  MaskingSchema,
  RouteSchema,
  AdapterEntrySchema,
  BrowserSchema,
  RouteBudgetSchema,
  PerformanceSchema,
  AccessibilitySchema,
  BoundaryTestingSchema,
  SuiteSchema,
  TestPlanSchema,
  FlakySchema,
  LayoutShiftSchema,
  SentinelConfigSchema,
  DiscoverySchema,
  AutoMaskingSchema,
  AdaptiveThresholdsSchema,
  WatchSchema,
} from './config-schema.js';
import { BREAKPOINT_TEMPLATES } from './breakpoint-templates.js';

// Shared base config for SentinelConfigSchema tests
const baseConfig = {
  project: 'test-project',
  baseUrl: 'http://localhost:3000',
  capture: {
    routes: [{ path: '/', name: 'home' }],
  },
};

describe('ViewportSchema', () => {
  it('accepts valid viewport format', () => {
    expect(ViewportSchema.parse('1280x720')).toBe('1280x720');
    expect(ViewportSchema.parse('1920x1080')).toBe('1920x1080');
    expect(ViewportSchema.parse('320x480')).toBe('320x480');
  });

  it('rejects invalid viewport formats', () => {
    expect(() => ViewportSchema.parse('1280')).toThrow();
    expect(() => ViewportSchema.parse('1280X720')).toThrow();
    expect(() => ViewportSchema.parse('1280 x 720')).toThrow();
    expect(() => ViewportSchema.parse('widthxheight')).toThrow();
    expect(() => ViewportSchema.parse('')).toThrow();
    expect(() => ViewportSchema.parse('x720')).toThrow();
    expect(() => ViewportSchema.parse('1280x')).toThrow();
  });
});

describe('ThresholdSchema', () => {
  it('accepts valid thresholds', () => {
    const result = ThresholdSchema.parse({ pixelDiffPercent: 5, ssimMin: 0.95 });
    expect(result.pixelDiffPercent).toBe(5);
    expect(result.ssimMin).toBe(0.95);
  });

  it('accepts empty object (all optional)', () => {
    const result = ThresholdSchema.parse({});
    expect(result.pixelDiffPercent).toBeUndefined();
    expect(result.ssimMin).toBeUndefined();
  });

  it('accepts boundary values', () => {
    expect(ThresholdSchema.parse({ pixelDiffPercent: 0 }).pixelDiffPercent).toBe(0);
    expect(ThresholdSchema.parse({ pixelDiffPercent: 100 }).pixelDiffPercent).toBe(100);
    expect(ThresholdSchema.parse({ ssimMin: 0 }).ssimMin).toBe(0);
    expect(ThresholdSchema.parse({ ssimMin: 1 }).ssimMin).toBe(1);
  });

  it('rejects out-of-range pixelDiffPercent', () => {
    expect(() => ThresholdSchema.parse({ pixelDiffPercent: -1 })).toThrow();
    expect(() => ThresholdSchema.parse({ pixelDiffPercent: 101 })).toThrow();
  });

  it('rejects out-of-range ssimMin', () => {
    expect(() => ThresholdSchema.parse({ ssimMin: -0.1 })).toThrow();
    expect(() => ThresholdSchema.parse({ ssimMin: 1.1 })).toThrow();
  });
});

describe('ParameterDimensionSchema', () => {
  it('accepts array with at least one non-empty string', () => {
    const result = ParameterDimensionSchema.parse({ values: ['en', 'fr'] });
    expect(result.values).toEqual(['en', 'fr']);
  });

  it('rejects empty values array', () => {
    expect(() => ParameterDimensionSchema.parse({ values: [] })).toThrow();
  });

  it('rejects empty strings in values', () => {
    expect(() => ParameterDimensionSchema.parse({ values: [''] })).toThrow();
  });
});

describe('MaskStrategySchema', () => {
  it('accepts valid strategies', () => {
    expect(MaskStrategySchema.parse('hide')).toBe('hide');
    expect(MaskStrategySchema.parse('remove')).toBe('remove');
    expect(MaskStrategySchema.parse('placeholder')).toBe('placeholder');
  });

  it('rejects invalid strategy', () => {
    expect(() => MaskStrategySchema.parse('blur')).toThrow();
  });
});

describe('MaskRuleSchema', () => {
  it('accepts valid rule with default strategy', () => {
    const result = MaskRuleSchema.parse({ selector: '.ad-banner' });
    expect(result.selector).toBe('.ad-banner');
    expect(result.strategy).toBe('hide');
    expect(result.color).toBeUndefined();
  });

  it('accepts rule with explicit strategy and color', () => {
    const result = MaskRuleSchema.parse({
      selector: '#dynamic-content',
      strategy: 'placeholder',
      color: '#ff0000',
    });
    expect(result.strategy).toBe('placeholder');
    expect(result.color).toBe('#ff0000');
  });

  it('rejects empty selector', () => {
    expect(() => MaskRuleSchema.parse({ selector: '' })).toThrow();
  });
});

describe('MaskingSchema', () => {
  it('defaults rules to empty array', () => {
    const result = MaskingSchema.parse({});
    expect(result.rules).toEqual([]);
  });

  it('accepts rules array', () => {
    const result = MaskingSchema.parse({
      rules: [{ selector: '.ad', strategy: 'hide' }],
    });
    expect(result.rules).toHaveLength(1);
  });
});

describe('RouteSchema', () => {
  it('accepts valid route with minimal fields', () => {
    const result = RouteSchema.parse({ path: '/home', name: 'Home' });
    expect(result.path).toBe('/home');
    expect(result.name).toBe('Home');
  });

  it('accepts route with all optional fields', () => {
    const result = RouteSchema.parse({
      path: '/dashboard',
      name: 'Dashboard',
      viewports: ['1280x720', '375x667'],
      mask: ['.dynamic-date'],
      thresholds: { pixelDiffPercent: 2 },
      parameters: { locale: { values: ['en', 'fr'] } },
      masking: { rules: [{ selector: '.ad' }] },
    });
    expect(result.viewports).toHaveLength(2);
    expect(result.mask).toEqual(['.dynamic-date']);
    expect(result.parameters?.locale.values).toEqual(['en', 'fr']);
  });

  it('rejects path not starting with /', () => {
    expect(() => RouteSchema.parse({ path: 'home', name: 'Home' })).toThrow();
  });
});

describe('AdapterEntrySchema', () => {
  it('accepts storybook adapter', () => {
    const result = AdapterEntrySchema.parse({
      type: 'storybook',
      storybookUrl: 'http://localhost:6006',
    });
    expect(result.type).toBe('storybook');
  });

  it('accepts storybook adapter with storyIds', () => {
    const result = AdapterEntrySchema.parse({
      type: 'storybook',
      storybookUrl: 'http://localhost:6006',
      storyIds: ['button--primary', 'card--default'],
    });
    expect(result.type).toBe('storybook');
  });

  it('accepts image adapter', () => {
    const result = AdapterEntrySchema.parse({
      type: 'image',
      directory: './screenshots',
    });
    expect(result.type).toBe('image');
  });

  it('accepts tokens adapter', () => {
    const result = AdapterEntrySchema.parse({
      type: 'tokens',
      tokenFilePath: './tokens.json',
      targetUrl: 'http://localhost:3000',
    });
    expect(result.type).toBe('tokens');
  });

  it('accepts figma adapter', () => {
    const result = AdapterEntrySchema.parse({
      type: 'figma',
      accessToken: 'figd_xxx',
      fileKey: 'abc123',
      nodeIds: ['1:2', '3:4'],
      cacheBucket: 's3://bucket',
      dbConnectionString: 'postgres://localhost/db',
    });
    expect(result.type).toBe('figma');
  });

  it('rejects invalid adapter type', () => {
    expect(() =>
      AdapterEntrySchema.parse({ type: 'puppeteer', url: 'http://localhost' })
    ).toThrow();
  });

  it('rejects storybook adapter with invalid URL', () => {
    expect(() =>
      AdapterEntrySchema.parse({ type: 'storybook', storybookUrl: 'not-a-url' })
    ).toThrow();
  });
});

describe('BrowserSchema', () => {
  it('accepts valid browsers', () => {
    expect(BrowserSchema.parse('chromium')).toBe('chromium');
    expect(BrowserSchema.parse('firefox')).toBe('firefox');
    expect(BrowserSchema.parse('webkit')).toBe('webkit');
  });

  it('rejects invalid browser', () => {
    expect(() => BrowserSchema.parse('chrome')).toThrow();
    expect(() => BrowserSchema.parse('safari')).toThrow();
  });
});

describe('RouteBudgetSchema', () => {
  it('accepts valid budget', () => {
    const result = RouteBudgetSchema.parse({
      route: '/home',
      performance: 90,
      accessibility: 100,
    });
    expect(result.route).toBe('/home');
    expect(result.performance).toBe(90);
  });

  it('rejects route not starting with /', () => {
    expect(() => RouteBudgetSchema.parse({ route: 'home' })).toThrow();
  });

  it('rejects out-of-range score', () => {
    expect(() => RouteBudgetSchema.parse({ route: '/', performance: 101 })).toThrow();
    expect(() => RouteBudgetSchema.parse({ route: '/', performance: -1 })).toThrow();
  });
});

describe('FlakySchema', () => {
  it('applies defaults', () => {
    const result = FlakySchema.parse({});
    expect(result.maxRetries).toBe(3);
    expect(result.stabilityThreshold).toBe(70);
    expect(result.excludeUnstableFromBlocking).toBe(false);
  });

  it('accepts custom values', () => {
    const result = FlakySchema.parse({
      maxRetries: 5,
      stabilityThreshold: 90,
      excludeUnstableFromBlocking: true,
    });
    expect(result.maxRetries).toBe(5);
    expect(result.stabilityThreshold).toBe(90);
    expect(result.excludeUnstableFromBlocking).toBe(true);
  });

  it('rejects maxRetries out of range', () => {
    expect(() => FlakySchema.parse({ maxRetries: -1 })).toThrow();
    expect(() => FlakySchema.parse({ maxRetries: 11 })).toThrow();
  });

  it('rejects stabilityThreshold out of range', () => {
    expect(() => FlakySchema.parse({ stabilityThreshold: -1 })).toThrow();
    expect(() => FlakySchema.parse({ stabilityThreshold: 101 })).toThrow();
  });
});

describe('LayoutShiftSchema', () => {
  it('applies defaults', () => {
    const result = LayoutShiftSchema.parse({});
    expect(result.enabled).toBe(false);
    expect(result.minMagnitude).toBe(5);
    expect(result.regressionThreshold).toBe(20);
    expect(result.selectors).toBeUndefined();
  });

  it('accepts custom values', () => {
    const result = LayoutShiftSchema.parse({
      enabled: true,
      minMagnitude: 10,
      regressionThreshold: 50,
      selectors: ['.header', '.footer'],
    });
    expect(result.enabled).toBe(true);
    expect(result.minMagnitude).toBe(10);
    expect(result.regressionThreshold).toBe(50);
    expect(result.selectors).toEqual(['.header', '.footer']);
  });

  it('rejects minMagnitude below 1', () => {
    expect(() => LayoutShiftSchema.parse({ minMagnitude: 0 })).toThrow();
  });

  it('rejects regressionThreshold below 1', () => {
    expect(() => LayoutShiftSchema.parse({ regressionThreshold: 0 })).toThrow();
  });
});

describe('AccessibilitySchema', () => {
  it('applies defaults', () => {
    const result = AccessibilitySchema.parse({});
    expect(result.enabled).toBe(false);
    expect(result.tags).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
    expect(result.exclude).toBeUndefined();
    expect(result.disableRules).toBeUndefined();
  });

  it('accepts custom tags', () => {
    const result = AccessibilitySchema.parse({
      enabled: true,
      tags: ['wcag2a'],
      exclude: ['.skip-a11y'],
      disableRules: ['color-contrast'],
    });
    expect(result.enabled).toBe(true);
    expect(result.tags).toEqual(['wcag2a']);
    expect(result.exclude).toEqual(['.skip-a11y']);
    expect(result.disableRules).toEqual(['color-contrast']);
  });
});

describe('BoundaryTestingSchema', () => {
  it('applies defaults', () => {
    const result = BoundaryTestingSchema.parse({});
    expect(result.enabled).toBe(false);
    expect(result.mode).toBe('below');
  });

  it('accepts all mode values', () => {
    expect(BoundaryTestingSchema.parse({ mode: 'below' }).mode).toBe('below');
    expect(BoundaryTestingSchema.parse({ mode: 'above' }).mode).toBe('above');
    expect(BoundaryTestingSchema.parse({ mode: 'both' }).mode).toBe('both');
  });

  it('rejects invalid mode', () => {
    expect(() => BoundaryTestingSchema.parse({ mode: 'around' })).toThrow();
  });
});

describe('PerformanceSchema', () => {
  it('applies defaults', () => {
    const result = PerformanceSchema.parse({});
    expect(result.enabled).toBe(false);
    expect(result.thresholds).toBeUndefined();
    expect(result.budgets).toBeUndefined();
  });

  it('accepts thresholds and budgets', () => {
    const result = PerformanceSchema.parse({
      enabled: true,
      thresholds: { performance: 90, accessibility: 95 },
      budgets: [
        { route: '/home', performance: 85 },
        { route: '/about', seo: 90 },
      ],
    });
    expect(result.enabled).toBe(true);
    expect(result.thresholds?.performance).toBe(90);
    expect(result.budgets).toHaveLength(2);
  });
});

describe('SuiteSchema', () => {
  it('accepts valid suite', () => {
    const result = SuiteSchema.parse({ routes: ['/home', '/about'] });
    expect(result.routes).toEqual(['/home', '/about']);
  });

  it('rejects route not starting with /', () => {
    expect(() => SuiteSchema.parse({ routes: ['home'] })).toThrow();
  });
});

describe('TestPlanSchema', () => {
  it('accepts valid test plan', () => {
    const result = TestPlanSchema.parse({
      steps: [{ suite: 'smoke' }, { suite: 'full' }],
    });
    expect(result.steps).toHaveLength(2);
  });

  it('rejects empty steps', () => {
    expect(() => TestPlanSchema.parse({ steps: [] })).toThrow();
  });
});

describe('SentinelConfigSchema', () => {
  it('accepts minimal valid config with routes', () => {
    const result = SentinelConfigSchema.parse(baseConfig);
    expect(result.project).toBe('test-project');
    expect(result.browsers).toEqual(['chromium']);
    expect(result.capture.viewports).toEqual(['1280x720']);
    expect(result.maxCapturesPerRun).toBe(500);
  });

  it('accepts minimal valid config with adapters instead of routes', () => {
    const result = SentinelConfigSchema.parse({
      project: 'test-project',
      baseUrl: 'http://localhost:3000',
      capture: { routes: [] },
      adapters: [{ type: 'image', directory: './screenshots' }],
    });
    expect(result.adapters).toHaveLength(1);
  });

  it('rejects config with neither routes nor adapters', () => {
    expect(() =>
      SentinelConfigSchema.parse({
        project: 'test-project',
        baseUrl: 'http://localhost:3000',
        capture: { routes: [] },
      })
    ).toThrow('At least one route, adapter, or discovery.mode=auto must be configured');
  });

  it('rejects suite referencing non-existent route', () => {
    try {
      SentinelConfigSchema.parse({
        ...baseConfig,
        suites: {
          smoke: { routes: ['/nonexistent'] },
        },
      });
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ZodError);
      const zodErr = e as ZodError;
      const issue = zodErr.issues.find((i) =>
        i.message.includes('references route "/nonexistent"')
      );
      expect(issue).toBeDefined();
    }
  });

  it('accepts suite referencing existing route', () => {
    const result = SentinelConfigSchema.parse({
      ...baseConfig,
      suites: {
        smoke: { routes: ['/'] },
      },
    });
    expect(result.suites?.smoke.routes).toEqual(['/']);
  });

  it('rejects testPlan referencing non-existent suite', () => {
    try {
      SentinelConfigSchema.parse({
        ...baseConfig,
        suites: {
          smoke: { routes: ['/'] },
        },
        testPlans: {
          ci: { steps: [{ suite: 'nonexistent' }] },
        },
      });
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ZodError);
      const zodErr = e as ZodError;
      const issue = zodErr.issues.find((i) =>
        i.message.includes('references suite "nonexistent"')
      );
      expect(issue).toBeDefined();
    }
  });

  it('accepts testPlan referencing existing suite', () => {
    const result = SentinelConfigSchema.parse({
      ...baseConfig,
      suites: {
        smoke: { routes: ['/'] },
      },
      testPlans: {
        ci: { steps: [{ suite: 'smoke' }] },
      },
    });
    expect(result.testPlans?.ci.steps).toHaveLength(1);
  });

  it('accepts full config with all optional sections', () => {
    const result = SentinelConfigSchema.parse({
      ...baseConfig,
      browsers: ['chromium', 'firefox'],
      thresholds: { pixelDiffPercent: 1, ssimMin: 0.99 },
      browserThresholds: { firefox: { pixelDiffPercent: 3 } },
      accessibility: { enabled: true },
      performance: { enabled: true, thresholds: { performance: 90 } },
      boundaryTesting: { enabled: true, mode: 'both' },
      flaky: { maxRetries: 5 },
      layoutShift: { enabled: true },
      masking: { rules: [{ selector: '.ad' }] },
      maxCapturesPerRun: 100,
    });
    expect(result.browsers).toEqual(['chromium', 'firefox']);
    expect(result.thresholds?.pixelDiffPercent).toBe(1);
    expect(result.accessibility?.enabled).toBe(true);
    expect(result.performance?.enabled).toBe(true);
    expect(result.boundaryTesting?.mode).toBe('both');
    expect(result.flaky?.maxRetries).toBe(5);
    expect(result.layoutShift?.enabled).toBe(true);
    expect(result.maxCapturesPerRun).toBe(100);
  });
});

describe('discovery config', () => {
  it('accepts discovery.mode = auto with empty routes', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test',
      baseUrl: 'http://localhost:3000',
      capture: { routes: [] },
      discovery: { mode: 'auto' },
    });
    expect(config.discovery?.mode).toBe('auto');
  });

  it('defaults discovery to undefined (manual mode)', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test',
      baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
    });
    expect(config.discovery).toBeUndefined();
  });

  it('accepts crawlDepth and crawlMaxPages options', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test',
      baseUrl: 'http://localhost:3000',
      capture: { routes: [] },
      discovery: { mode: 'auto', crawlDepth: 5, crawlMaxPages: 100 },
    });
    expect(config.discovery?.crawlDepth).toBe(5);
    expect(config.discovery?.crawlMaxPages).toBe(100);
  });
});

describe('autoMasking config', () => {
  it('accepts autoMasking.enabled boolean', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test',
      baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
      autoMasking: { enabled: true },
    });
    expect(config.autoMasking?.enabled).toBe(true);
  });
});

describe('adaptiveThresholds config', () => {
  it('accepts adaptiveThresholds with minRuns', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test',
      baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
      adaptiveThresholds: { enabled: true, minRuns: 10 },
    });
    expect(config.adaptiveThresholds?.enabled).toBe(true);
    expect(config.adaptiveThresholds?.minRuns).toBe(10);
  });

  it('defaults minRuns to 5', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test',
      baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
      adaptiveThresholds: { enabled: true },
    });
    expect(config.adaptiveThresholds?.minRuns).toBe(5);
  });
});

describe('components config', () => {
  it('accepts components with storybook source', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test', baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
      components: { source: 'storybook' },
    });
    expect(config.components?.source).toBe('storybook');
  });

  it('accepts components with url, include, exclude, viewports', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test', baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
      components: {
        source: 'storybook', url: 'http://localhost:6006',
        include: ['Button/**'], exclude: ['**/*Deprecated*'],
        viewports: ['400x300'],
      },
    });
    expect(config.components?.url).toBe('http://localhost:6006');
    expect(config.components?.include).toEqual(['Button/**']);
  });

  it('defaults components to undefined', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test', baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
    });
    expect(config.components).toBeUndefined();
  });
});

describe('crossBrowserBaselines config', () => {
  it('accepts crossBrowserBaselines boolean', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test',
      baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
      crossBrowserBaselines: true,
    });
    expect(config.crossBrowserBaselines).toBe(true);
  });

  it('defaults crossBrowserBaselines to false', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test',
      baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
    });
    expect(config.crossBrowserBaselines).toBe(false);
  });
});

describe('designDrift config', () => {
  it('accepts designDrift with enabled flag', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test', baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
      designDrift: { enabled: true },
    });
    expect(config.designDrift?.enabled).toBe(true);
  });
  it('defaults designDir to .sentinel/designs', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test', baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
      designDrift: { enabled: true },
    });
    expect(config.designDrift?.designDir).toBe('.sentinel/designs');
  });
  it('accepts explicit mappings', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test', baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
      designDrift: { enabled: true, mappings: [{ design: 'homepage.png', route: '/', viewport: '1280x720' }] },
    });
    expect(config.designDrift?.mappings).toHaveLength(1);
  });
  it('defaults designDrift to undefined', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test', baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
    });
    expect(config.designDrift).toBeUndefined();
  });
});

describe('watch config', () => {
  it('accepts watch with paths array', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test', baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
      watch: { paths: ['src/**', 'app/**'] },
    });
    expect(config.watch?.paths).toEqual(['src/**', 'app/**']);
  });
  it('defaults debounceMs to 500 and clearScreen to true', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test', baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
      watch: { paths: ['src/**'] },
    });
    expect(config.watch?.debounceMs).toBe(500);
    expect(config.watch?.clearScreen).toBe(true);
  });
  it('defaults watch to undefined', () => {
    const config = SentinelConfigSchema.parse({
      project: 'test', baseUrl: 'http://localhost:3000',
      capture: { routes: [{ path: '/', name: 'home' }] },
    });
    expect(config.watch).toBeUndefined();
  });
});

describe('BREAKPOINT_TEMPLATES', () => {
  it('has tailwind template with 5 entries', () => {
    expect(BREAKPOINT_TEMPLATES.tailwind).toHaveLength(5);
  });

  it('has bootstrap template with 5 entries', () => {
    expect(BREAKPOINT_TEMPLATES.bootstrap).toHaveLength(5);
  });

  it('all tailwind entries have positive dimensions', () => {
    for (const bp of BREAKPOINT_TEMPLATES.tailwind) {
      expect(bp.width).toBeGreaterThan(0);
      expect(bp.height).toBeGreaterThan(0);
      expect(bp.name).toBeTruthy();
    }
  });

  it('all bootstrap entries have positive dimensions', () => {
    for (const bp of BREAKPOINT_TEMPLATES.bootstrap) {
      expect(bp.width).toBeGreaterThan(0);
      expect(bp.height).toBeGreaterThan(0);
      expect(bp.name).toBeTruthy();
    }
  });

  it('tailwind breakpoints are in ascending width order', () => {
    const widths = BREAKPOINT_TEMPLATES.tailwind.map((bp) => bp.width);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1]);
    }
  });

  it('bootstrap breakpoints are in ascending width order', () => {
    const widths = BREAKPOINT_TEMPLATES.bootstrap.map((bp) => bp.width);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1]);
    }
  });
});
