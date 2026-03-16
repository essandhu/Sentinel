import { z } from 'zod';

export const ViewportSchema = z
  .string()
  .regex(/^\d+x\d+$/, 'Viewport must be "WIDTHxHEIGHT" (e.g. "1280x720")');

export const ThresholdSchema = z.object({
  pixelDiffPercent: z.number().min(0).max(100).optional(),
  ssimMin: z.number().min(0).max(1).optional(),
});

export const ParameterDimensionSchema = z.object({
  values: z.array(z.string().min(1)).min(1),
});

export const MaskStrategySchema = z.enum(['hide', 'remove', 'placeholder']);

export const MaskRuleSchema = z.object({
  selector: z.string().min(1),
  strategy: MaskStrategySchema.default('hide'),
  color: z.string().optional(), // Only meaningful for 'placeholder'
});

export const MaskingSchema = z.object({
  rules: z.array(MaskRuleSchema).default([]),
});

export type MaskRule = z.infer<typeof MaskRuleSchema>;
export type MaskStrategy = z.infer<typeof MaskStrategySchema>;

export const RouteSchema = z.object({
  path: z.string().startsWith('/'),
  name: z.string(),
  viewports: z.array(ViewportSchema).optional(),
  mask: z.array(z.string()).optional(),
  thresholds: ThresholdSchema.optional(),
  parameters: z.record(z.string(), ParameterDimensionSchema).optional(),
  masking: MaskingSchema.optional(),
});

const StorybookAdapterConfigSchema = z.object({
  type: z.literal('storybook'),
  storybookUrl: z.string().url(),
  storyIds: z.array(z.string()).optional(),
});

const ImageAdapterConfigSchema = z.object({
  type: z.literal('image'),
  directory: z.string(),
});

const TokenAdapterConfigSchema = z.object({
  type: z.literal('tokens'),
  tokenFilePath: z.string(),
  targetUrl: z.string(),
});

const FigmaAdapterConfigSchema = z.object({
  type: z.literal('figma'),
  accessToken: z.string(),
  fileKey: z.string(),
  nodeIds: z.array(z.string()),
  cacheBucket: z.string(),
  dbConnectionString: z.string(),
});

export const AdapterEntrySchema = z.discriminatedUnion('type', [
  StorybookAdapterConfigSchema,
  ImageAdapterConfigSchema,
  TokenAdapterConfigSchema,
  FigmaAdapterConfigSchema,
]);

export const BrowserSchema = z.enum(['chromium', 'firefox', 'webkit']);

export const RouteBudgetSchema = z.object({
  route: z.string().startsWith('/'),
  performance: z.number().int().min(0).max(100).optional(),
  accessibility: z.number().int().min(0).max(100).optional(),
  bestPractices: z.number().int().min(0).max(100).optional(),
  seo: z.number().int().min(0).max(100).optional(),
});

export const PerformanceSchema = z.object({
  enabled: z.boolean().default(false),
  thresholds: z.object({
    performance: z.number().min(0).max(100).optional(),
    accessibility: z.number().min(0).max(100).optional(),
    bestPractices: z.number().min(0).max(100).optional(),
    seo: z.number().min(0).max(100).optional(),
  }).optional(),
  budgets: z.array(RouteBudgetSchema).optional(),
});

export const AccessibilitySchema = z.object({
  enabled: z.boolean().default(false),
  tags: z.array(z.string()).default(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']),
  exclude: z.array(z.string()).optional(),
  disableRules: z.array(z.string()).optional(),
});

export const BoundaryTestingSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(['below', 'above', 'both']).default('below'),
});

export const SuiteSchema = z.object({
  routes: z.array(z.string().startsWith('/')),
  boundaryTesting: z.boolean().optional(),
});

export const TestPlanStepSchema = z.object({
  suite: z.string(),
});

export const TestPlanSchema = z.object({
  steps: z.array(TestPlanStepSchema).min(1),
});

export const FlakySchema = z.object({
  maxRetries: z.number().int().min(0).max(10).default(3),
  stabilityThreshold: z.number().int().min(0).max(100).default(70),
  excludeUnstableFromBlocking: z.boolean().default(false),
});

export const LayoutShiftSchema = z.object({
  enabled: z.boolean().default(false),
  minMagnitude: z.number().int().min(1).default(5),
  regressionThreshold: z.number().int().min(1).default(20),
  selectors: z.array(z.string()).optional(),
});

export const PluginConfigSchema = z.object({
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const DiscoverySchema = z.object({
  mode: z.enum(['auto', 'manual']).default('manual'),
  crawlDepth: z.number().int().min(1).max(10).optional(),
  crawlMaxPages: z.number().int().min(1).max(500).optional(),
});

export const AutoMaskingSchema = z.object({
  enabled: z.boolean().default(false),
});

export const AdaptiveThresholdsSchema = z.object({
  enabled: z.boolean().default(false),
  minRuns: z.number().int().min(1).default(5),
});

export const SentinelConfigSchema = z
  .object({
    project: z.string(),
    baseUrl: z.string().url(),
    browsers: z.array(BrowserSchema).default(['chromium']),
    capture: z.object({
      routes: z.array(RouteSchema).default([]),
      viewports: z.array(ViewportSchema).default(['1280x720']),
    }),
    adapters: z.array(AdapterEntrySchema).optional(),
    thresholds: ThresholdSchema.optional(),
    browserThresholds: z.record(BrowserSchema, ThresholdSchema).optional(),
    accessibility: AccessibilitySchema.optional(),
    performance: PerformanceSchema.optional(),
    boundaryTesting: BoundaryTestingSchema.optional(),
    flaky: FlakySchema.optional(),
    suites: z.record(z.string(), SuiteSchema).optional(),
    testPlans: z.record(z.string(), TestPlanSchema).optional(),
    masking: MaskingSchema.optional(),
    layoutShift: LayoutShiftSchema.optional(),
    maxCapturesPerRun: z.number().int().min(1).default(500),
    plugins: z.record(z.string(), PluginConfigSchema).optional(),
    discovery: DiscoverySchema.optional(),
    autoMasking: AutoMaskingSchema.optional(),
    adaptiveThresholds: AdaptiveThresholdsSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const isAutoDiscovery = data.discovery?.mode === 'auto';
    if (!isAutoDiscovery && !data.capture.routes.length && !data.adapters?.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one route, adapter, or discovery.mode=auto must be configured',
        path: ['capture', 'routes'],
      });
    }

    // Validate suite route paths exist in capture.routes
    if (data.suites) {
      const routePaths = new Set(data.capture.routes.map((r) => r.path));
      for (const [suiteName, suite] of Object.entries(data.suites)) {
        for (const routePath of suite.routes) {
          if (!routePaths.has(routePath)) {
            ctx.addIssue({
              code: 'custom',
              message: `Suite "${suiteName}" references route "${routePath}" which is not defined in capture.routes`,
              path: ['suites', suiteName, 'routes'],
            });
          }
        }
      }
    }

    // Validate testPlan step suites exist in suites
    if (data.testPlans) {
      const suiteNames = new Set(Object.keys(data.suites ?? {}));
      for (const [planName, plan] of Object.entries(data.testPlans)) {
        for (const step of plan.steps) {
          if (!suiteNames.has(step.suite)) {
            ctx.addIssue({
              code: 'custom',
              message: `Test plan "${planName}" references suite "${step.suite}" which is not defined in suites`,
              path: ['testPlans', planName, 'steps'],
            });
          }
        }
      }
    }
  });

export type SentinelConfigParsed = z.infer<typeof SentinelConfigSchema>;
