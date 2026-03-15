import { chromium, firefox, webkit, type BrowserType } from 'playwright';
import isDockerDefault from 'is-docker';
import { computeDomHash } from './dom-hash.js';
import { captureDomPositions, type ElementPosition } from './dom-positions.js';
import { parseViewport } from '../config/config-loader.js';
import { applyMasks, mergeMaskRules } from './mask-strategies.js';
import type { MaskRule } from '../config/config-schema.js';

const BROWSER_MAP: Record<string, BrowserType> = { chromium, firefox, webkit };

export interface CaptureTarget {
  routeName: string;
  routePath: string;
  viewport: string;
  browser: string;
  mask?: string[];
  breakpointName?: string;
  parameterName?: string | null;
}

export interface CaptureResult {
  routeName: string;
  routePath: string;
  viewport: string;
  browser: string;
  screenshotBuffer: Buffer;
  domHash: string;
  skipped: boolean;
  breakpointName?: string;
  parameterName?: string | null;
  domPositions: ElementPosition[] | null;
}

/** Route descriptor with proper parameterName typing */
export interface CaptureRoute {
  path: string;
  name: string;
  viewports?: string[];
  mask?: string[];
  masking?: { rules: MaskRule[] };
  parameterName?: string | null;
}

/** Minimal config interface for capture engine input */
export interface CaptureConfig {
  project: string;
  baseUrl: string;
  browsers?: string[];
  capture: { routes: CaptureRoute[]; viewports: string[] };
  /** Global masking rules applied to all routes */
  masking?: { rules: MaskRule[] };
}

/** Callback invoked after screenshot capture but before page.close() */
export type OnPageCaptured = (page: import('playwright').Page, result: CaptureResult) => Promise<void>;

const DOCKER_WARNING =
  'Sentinel capture: not running inside Docker. Screenshots may differ from CI baselines due to font rendering and OS differences.';

export interface CaptureEngineOptions {
  isDockerFn?: () => boolean;
}

export class CaptureEngine {
  private readonly isDockerFn: () => boolean;

  constructor(options: CaptureEngineOptions = {}) {
    this.isDockerFn = options.isDockerFn ?? isDockerDefault;
    if (!this.isDockerFn()) {
      console.warn(DOCKER_WARNING);
    }
  }

  async capture(
    config: CaptureConfig,
    previousDomHashes?: Map<string, string>,
    onPageCaptured?: OnPageCaptured,
  ): Promise<CaptureResult[]> {
    const results: CaptureResult[] = [];
    const routes = config.capture.routes;
    const browsers = config.browsers ?? ['chromium'];

    for (const browserName of browsers) {
      const browserType = BROWSER_MAP[browserName];
      const browser = await browserType.launch({ headless: true });

      try {
        // Collect all unique viewports across all routes
        const allViewportStrings = new Set<string>();
        for (const route of routes) {
          const viewports = route.viewports ?? config.capture.viewports;
          for (const vp of viewports) {
            allViewportStrings.add(vp);
          }
        }

        // Group routes by their effective viewport set
        // For each unique viewport, create one context and process all routes that use it
        for (const viewportStr of allViewportStrings) {
          const { width, height } = parseViewport(viewportStr);
          const context = await browser.newContext({
            viewport: { width, height },
          });

          try {
            for (const route of routes) {
              const effectiveViewports = route.viewports ?? config.capture.viewports;
              if (!effectiveViewports.includes(viewportStr)) {
                continue;
              }

              const page = await context.newPage();
              try {
                const url = route.path.startsWith('http') ? route.path : config.baseUrl + route.path;
                await page.goto(url, { waitUntil: 'domcontentloaded' });
                await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

                const domHash = await computeDomHash(page);
                const hashKey = `${route.name}:${viewportStr}:${browserName}`;

                if (previousDomHashes?.get(hashKey) === domHash) {
                  results.push({
                    routeName: route.name,
                    routePath: route.path,
                    viewport: viewportStr,
                    browser: browserName,
                    screenshotBuffer: Buffer.alloc(0),
                    domHash,
                    skipped: true,
                    parameterName: route.parameterName ?? null,
                    domPositions: null,
                  });
                } else {
                  // Capture DOM positions before screenshot (non-blocking)
                  const domPositions = await captureDomPositions(page);
                  // Apply masking strategy: if masking.rules is configured, use CSS/JS injection.
                  // If BOTH mask (string[]) and masking are present, masking takes precedence.
                  const effectiveMasks = mergeMaskRules(
                    config.masking?.rules ?? [],
                    route.masking?.rules ?? [],
                  );

                  let screenshotBuffer: Buffer | Uint8Array;
                  if (effectiveMasks.length > 0) {
                    // Strategy-based masking via CSS/JS injection (before screenshot)
                    await applyMasks(page, effectiveMasks);
                    screenshotBuffer = await page.screenshot({
                      animations: 'disabled',
                      fullPage: true,
                      type: 'png',
                    });
                  } else if (route.mask && route.mask.length > 0) {
                    // Legacy: Playwright built-in mask (pink overlay)
                    const maskLocators = route.mask.map((selector) =>
                      page.locator(selector),
                    );
                    screenshotBuffer = await page.screenshot({
                      animations: 'disabled',
                      mask: maskLocators,
                      fullPage: true,
                      type: 'png',
                    });
                  } else {
                    screenshotBuffer = await page.screenshot({
                      animations: 'disabled',
                      fullPage: true,
                      type: 'png',
                    });
                  }

                  const captureResult: CaptureResult = {
                    routeName: route.name,
                    routePath: route.path,
                    viewport: viewportStr,
                    browser: browserName,
                    screenshotBuffer: Buffer.from(screenshotBuffer),
                    domHash,
                    skipped: false,
                    parameterName: route.parameterName ?? null,
                    domPositions: domPositions.length > 0 ? domPositions : null,
                  };

                  results.push(captureResult);

                  // Run optional post-capture hook (e.g., axe audit) before page closes
                  if (onPageCaptured) {
                    try {
                      await onPageCaptured(page, captureResult);
                    } catch (hookError) {
                      console.error('[capture-engine] onPageCaptured hook failed:', hookError);
                    }
                  }
                }
              } finally {
                await page.close();
              }
            }
          } finally {
            await context.close();
          }
        }
      } finally {
        await browser.close();
      }
    }

    return results;
  }
}
