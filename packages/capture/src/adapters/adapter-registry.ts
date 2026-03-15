import {
  ImageBaselineAdapter,
  StorybookAdapter,
  DesignTokenAdapter,
  FigmaAdapter,
  storybookStoryUrl,
} from '@sentinel/adapters';
import type { DesignSpec } from '@sentinel/types';
import type { SentinelConfigParsed } from '../config/config-schema.js';
import type { Page } from 'playwright';

export interface AdapterDispatchResult {
  storybook: DesignSpec[];
  image: DesignSpec[];
  tokens: DesignSpec[];
  figma: DesignSpec[];
}

export interface TokenViolation {
  tokenName: string;
  expectedValue: string;
  actualValue: string;
  elementSelector: string;
}

export interface AdapterDispatchDeps {
  db?: any;
  storageClient?: any;
}

/**
 * Dispatches adapter calls based on the configured adapter entries.
 * Runs all adapters in parallel and returns results grouped by source type.
 */
export async function dispatchAdapters(
  adapters: SentinelConfigParsed['adapters'],
  deps: AdapterDispatchDeps,
): Promise<AdapterDispatchResult> {
  const result: AdapterDispatchResult = {
    storybook: [],
    image: [],
    tokens: [],
    figma: [],
  };

  if (!adapters || adapters.length === 0) {
    return result;
  }

  await Promise.all(
    adapters.map(async (entry) => {
      switch (entry.type) {
        case 'storybook': {
          const adapter = new StorybookAdapter();
          const specs = await adapter.loadAll({
            storybookUrl: entry.storybookUrl,
            storyIds: entry.storyIds,
          });
          result.storybook.push(...specs);
          break;
        }

        case 'image': {
          const adapter = new ImageBaselineAdapter();
          const specs = await adapter.loadAll({
            directory: entry.directory,
          });
          result.image.push(...specs);
          break;
        }

        case 'tokens': {
          const adapter = new DesignTokenAdapter();
          const specs = await adapter.loadAll({
            tokenFilePath: entry.tokenFilePath,
          });
          result.tokens.push(...specs);
          break;
        }

        case 'figma': {
          const adapter = new FigmaAdapter({
            db: deps.db,
            s3: deps.storageClient,
            isRateLimitedFn: deps.db
              ? undefined
              : async () => false,
            persistRateLimitFn: deps.db
              ? undefined
              : async () => undefined,
          });
          const specs = await adapter.loadAll({
            accessToken: entry.accessToken,
            fileKey: entry.fileKey,
            nodeIds: entry.nodeIds,
            cacheBucket: entry.cacheBucket,
            dbConnectionString: entry.dbConnectionString,
          });
          result.figma.push(...specs);
          break;
        }
      }
    }),
  );

  return result;
}

export interface SpecRoute {
  name: string;
  path: string;
  viewports?: string[];
  mask?: string[];
}

export interface SpecsToRoutesResult {
  routes: SpecRoute[];
  baselineSpecs: DesignSpec[];
}

/**
 * Converts adapter dispatch results into capture routes and baseline specs.
 *
 * - Storybook specs become routes (absolute iframe URLs via storybookStoryUrl)
 * - Image and Figma specs become baseline-only specs (no navigation needed)
 * - Token specs are handled separately via compareTokenSpec
 */
export function specsToRoutes(
  result: AdapterDispatchResult,
  adapterConfigs: SentinelConfigParsed['adapters'],
): SpecsToRoutesResult {
  const routes: SpecRoute[] = [];
  const baselineSpecs: DesignSpec[] = [];

  // Find all storybook adapter configs (for storybookUrl)
  const storybookConfigs = (adapterConfigs ?? []).filter(
    (c) => c.type === 'storybook',
  );

  // Convert storybook specs to routes
  for (const spec of result.storybook) {
    // Use the first storybook config's URL (common case: one storybook)
    const config = storybookConfigs[0];
    const storybookUrl = config ? config.storybookUrl : '';

    const storyId = spec.metadata.storyId ?? 'unknown';
    const name = spec.metadata.componentName ?? spec.metadata.storyId ?? 'storybook-unknown';
    const path = storybookStoryUrl(storybookUrl, storyId);

    routes.push({ name, path });
  }

  // Image and Figma specs are baselines only — no navigation
  for (const spec of result.image) {
    baselineSpecs.push(spec);
  }

  for (const spec of result.figma) {
    baselineSpecs.push(spec);
  }

  return { routes, baselineSpecs };
}

/**
 * Compares token specs against live CSS custom properties on a page.
 * Navigates to targetUrl and reads computed CSS values from :root.
 * Returns violations where actual CSS value differs from expected token value.
 * Tokens where the CSS variable is not found are silently skipped.
 */
export async function compareTokenSpec(
  page: Page,
  spec: DesignSpec,
  targetUrl: string,
): Promise<TokenViolation[]> {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  const violations: TokenViolation[] = [];

  for (const [tokenPath, tokenValue] of Object.entries(spec.tokens ?? {})) {
    const cssVarName = `--${tokenPath.replace(/\./g, '-')}`;

    const computedValue = await page.evaluate((varName: string) => {
      const style = getComputedStyle(document.documentElement);
      return style.getPropertyValue(varName).trim();
    }, cssVarName);

    if (computedValue && computedValue !== String(tokenValue.value)) {
      violations.push({
        tokenName: tokenPath,
        expectedValue: String(tokenValue.value),
        actualValue: computedValue,
        elementSelector: ':root',
      });
    }
  }

  return violations;
}
