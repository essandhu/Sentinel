import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SentinelConfigParsed } from '../config/config-schema.js';

// Mock playwright before importing capture engine
vi.mock('playwright', () => {
  function createMockBrowser() {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
      locator: vi.fn().mockImplementation((selector: string) => ({ selector })),
      close: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue('<div>content</div>'),
    };

    const mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    };

    return mockBrowser;
  }

  return {
    chromium: {
      launch: vi.fn().mockImplementation(() => Promise.resolve(createMockBrowser())),
    },
    firefox: {
      launch: vi.fn().mockImplementation(() => Promise.resolve(createMockBrowser())),
    },
    webkit: {
      launch: vi.fn().mockImplementation(() => Promise.resolve(createMockBrowser())),
    },
  };
});

// Mock is-docker
vi.mock('is-docker', () => ({
  default: vi.fn().mockReturnValue(false),
}));

// Mock dom-hash
vi.mock('./dom-hash.js', () => ({
  computeDomHash: vi.fn().mockResolvedValue('a'.repeat(64)),
}));

// Mock dom-positions
vi.mock('./dom-positions.js', () => ({
  captureDomPositions: vi.fn().mockResolvedValue([]),
}));

import { CaptureEngine } from './capture-engine.js';
import { chromium, firefox, webkit } from 'playwright';
import isDocker from 'is-docker';
import { computeDomHash } from './dom-hash.js';

function makeConfig(overrides: Partial<SentinelConfigParsed> = {}): SentinelConfigParsed {
  return {
    project: 'test-project',
    baseUrl: 'http://localhost:3000',
    capture: {
      routes: [
        { path: '/home', name: 'home' },
        { path: '/about', name: 'about' },
      ],
      viewports: ['1280x720', '768x1024'],
    },
    ...overrides,
  };
}

describe('CaptureEngine', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Default: not in Docker
    vi.mocked(isDocker).mockReturnValue(false);
    // Default: hash returns a unique value per call (mock resolves to same value)
    vi.mocked(computeDomHash).mockResolvedValue('a'.repeat(64));
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('captures all route x viewport combinations', async () => {
    const engine = new CaptureEngine({ isDockerFn: () => false });
    const config = makeConfig();
    const results = await engine.capture(config);

    // 2 routes x 2 viewports = 4 results
    expect(results).toHaveLength(4);
    // Check that each combination is present
    const keys = results.map((r) => `${r.routeName}:${r.viewport}`);
    expect(keys).toContain('home:1280x720');
    expect(keys).toContain('home:768x1024');
    expect(keys).toContain('about:1280x720');
    expect(keys).toContain('about:768x1024');
  });

  it('passes animations: disabled to page.screenshot', async () => {
    const engine = new CaptureEngine({ isDockerFn: () => false });
    const config = makeConfig({
      capture: {
        routes: [{ path: '/home', name: 'home' }],
        viewports: ['1280x720'],
      },
    });
    await engine.capture(config);

    const { chromium: mockChromium } = await import('playwright');
    const browser = await vi.mocked(mockChromium.launch).mock.results[0].value;
    const context = await vi.mocked(browser.newContext).mock.results[0].value;
    const page = await vi.mocked(context.newPage).mock.results[0].value;

    expect(page.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ animations: 'disabled' }),
    );
  });

  it('passes mask selectors as locators to page.screenshot', async () => {
    const engine = new CaptureEngine({ isDockerFn: () => false });
    const config = makeConfig({
      capture: {
        routes: [{ path: '/home', name: 'home', mask: ['.clock', '.avatar'] }],
        viewports: ['1280x720'],
      },
    });
    await engine.capture(config);

    const { chromium: mockChromium } = await import('playwright');
    const browser = await vi.mocked(mockChromium.launch).mock.results[0].value;
    const context = await vi.mocked(browser.newContext).mock.results[0].value;
    const page = await vi.mocked(context.newPage).mock.results[0].value;

    expect(page.locator).toHaveBeenCalledWith('.clock');
    expect(page.locator).toHaveBeenCalledWith('.avatar');
    expect(page.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        mask: expect.arrayContaining([
          expect.objectContaining({ selector: '.clock' }),
          expect.objectContaining({ selector: '.avatar' }),
        ]),
      }),
    );
  });

  it('uses per-route viewports when specified, ignoring global viewports', async () => {
    const engine = new CaptureEngine({ isDockerFn: () => false });
    const config = makeConfig({
      capture: {
        routes: [{ path: '/mobile', name: 'mobile', viewports: ['375x667'] }],
        viewports: ['1280x720'],
      },
    });
    const results = await engine.capture(config);

    // Only the per-route viewport should be used
    expect(results).toHaveLength(1);
    expect(results[0].viewport).toBe('375x667');
  });

  it('skips capture when DOM hash matches previousDomHashes', async () => {
    const engine = new CaptureEngine({ isDockerFn: () => false });
    const config = makeConfig({
      capture: {
        routes: [{ path: '/home', name: 'home' }],
        viewports: ['1280x720'],
      },
    });
    const knownHash = 'a'.repeat(64);
    vi.mocked(computeDomHash).mockResolvedValue(knownHash);

    const previousHashes = new Map([['home:1280x720:chromium', knownHash]]);
    const results = await engine.capture(config, previousHashes);

    expect(results).toHaveLength(1);
    expect(results[0].skipped).toBe(true);

    // page.screenshot should not be called for skipped pages
    const { chromium: mockChromium } = await import('playwright');
    const browser = await vi.mocked(mockChromium.launch).mock.results[0].value;
    const context = await vi.mocked(browser.newContext).mock.results[0].value;
    const page = await vi.mocked(context.newPage).mock.results[0].value;
    expect(page.screenshot).not.toHaveBeenCalled();
  });

  it('closes browser even when page.goto throws an error', async () => {
    const { chromium: mockChromium } = await import('playwright');

    // Create a fresh mock browser that throws on goto
    const errorPage = {
      goto: vi.fn().mockRejectedValue(new Error('Navigation failed')),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn(),
      locator: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue('<div></div>'),
    };
    const errorContext = {
      newPage: vi.fn().mockResolvedValue(errorPage),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const errorBrowser = {
      newContext: vi.fn().mockResolvedValue(errorContext),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(mockChromium.launch).mockResolvedValueOnce(errorBrowser as any);

    const engine = new CaptureEngine({ isDockerFn: () => false });
    const config = makeConfig({
      capture: {
        routes: [{ path: '/home', name: 'home' }],
        viewports: ['1280x720'],
      },
    });

    await expect(engine.capture(config)).rejects.toThrow('Navigation failed');
    expect(errorBrowser.close).toHaveBeenCalledOnce();
  });

  it('emits Docker warning when not in Docker', () => {
    vi.mocked(isDocker).mockReturnValue(false);
    // eslint-disable-next-line no-new
    new CaptureEngine({ isDockerFn: isDocker });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('not running inside Docker'),
    );
  });

  it('does not emit Docker warning when in Docker', () => {
    vi.mocked(isDocker).mockReturnValue(true);
    // eslint-disable-next-line no-new
    new CaptureEngine({ isDockerFn: isDocker });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('navigates to absolute URL directly without prepending baseUrl', async () => {
    const engine = new CaptureEngine({ isDockerFn: () => false });
    const absoluteUrl = 'http://localhost:6006/iframe.html?id=btn--primary&viewMode=story';
    const config = makeConfig({
      capture: {
        routes: [{ path: absoluteUrl, name: 'storybook-btn' }],
        viewports: ['1280x720'],
      },
    });
    await engine.capture(config);

    const { chromium: mockChromium } = await import('playwright');
    const browser = await vi.mocked(mockChromium.launch).mock.results[0].value;
    const context = await vi.mocked(browser.newContext).mock.results[0].value;
    const page = await vi.mocked(context.newPage).mock.results[0].value;

    // Should navigate to the absolute URL directly, NOT baseUrl + absoluteUrl
    expect(page.goto).toHaveBeenCalledWith(absoluteUrl, { waitUntil: 'domcontentloaded' });
  });

  it('navigates to baseUrl + path for relative paths (existing behavior)', async () => {
    const engine = new CaptureEngine({ isDockerFn: () => false });
    const config = makeConfig({
      capture: {
        routes: [{ path: '/dashboard', name: 'dashboard' }],
        viewports: ['1280x720'],
      },
    });
    await engine.capture(config);

    const { chromium: mockChromium } = await import('playwright');
    const browser = await vi.mocked(mockChromium.launch).mock.results[0].value;
    const context = await vi.mocked(browser.newContext).mock.results[0].value;
    const page = await vi.mocked(context.newPage).mock.results[0].value;

    // Should navigate to baseUrl + path
    expect(page.goto).toHaveBeenCalledWith('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' });
  });

  it('with browsers: [chromium, firefox] launches each browser and returns results with browser field', async () => {
    const engine = new CaptureEngine({ isDockerFn: () => false });
    const config = makeConfig({
      browsers: ['chromium', 'firefox'],
      capture: {
        routes: [{ path: '/home', name: 'home' }],
        viewports: ['1280x720'],
      },
    });
    const results = await engine.capture(config);

    // 1 route x 1 viewport x 2 browsers = 2 results
    expect(results).toHaveLength(2);
    expect(results[0].browser).toBe('chromium');
    expect(results[1].browser).toBe('firefox');

    const { chromium: mockChromium, firefox: mockFirefox } = await import('playwright');
    expect(vi.mocked(mockChromium.launch)).toHaveBeenCalled();
    expect(vi.mocked(mockFirefox.launch)).toHaveBeenCalled();
  });

  it('with default config (no browsers field) uses chromium only', async () => {
    const engine = new CaptureEngine({ isDockerFn: () => false });
    const config = makeConfig({
      capture: {
        routes: [{ path: '/home', name: 'home' }],
        viewports: ['1280x720'],
      },
    });
    const results = await engine.capture(config);

    expect(results).toHaveLength(1);
    expect(results[0].browser).toBe('chromium');
  });

  it('includes browser field on each CaptureResult', async () => {
    const engine = new CaptureEngine({ isDockerFn: () => false });
    const config = makeConfig({
      browsers: ['chromium', 'webkit'],
      capture: {
        routes: [{ path: '/home', name: 'home' }],
        viewports: ['1280x720'],
      },
    });
    const results = await engine.capture(config);

    for (const result of results) {
      expect(result).toHaveProperty('browser');
      expect(typeof result.browser).toBe('string');
    }
  });

  it('DOM hash dedup key includes browser dimension', async () => {
    const engine = new CaptureEngine({ isDockerFn: () => false });
    const knownHash = 'a'.repeat(64);
    vi.mocked(computeDomHash).mockResolvedValue(knownHash);

    const config = makeConfig({
      browsers: ['chromium', 'firefox'],
      capture: {
        routes: [{ path: '/home', name: 'home' }],
        viewports: ['1280x720'],
      },
    });

    // Only chromium hash matches; firefox should not be skipped
    const previousHashes = new Map([['home:1280x720:chromium', knownHash]]);
    const results = await engine.capture(config, previousHashes);

    expect(results).toHaveLength(2);
    const chromiumResult = results.find(r => r.browser === 'chromium');
    const firefoxResult = results.find(r => r.browser === 'firefox');
    expect(chromiumResult?.skipped).toBe(true);
    expect(firefoxResult?.skipped).toBe(false);
  });
});
