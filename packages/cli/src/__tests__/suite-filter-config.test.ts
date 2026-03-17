import { describe, it, expect } from 'vitest';
import { SentinelConfigSchema } from '@sentinel-vrt/capture';

describe('suite-filtered config passes Zod validation', () => {
  it('filtered config with suites stripped is valid', () => {
    const fullConfig = {
      project: 'test',
      baseUrl: 'http://localhost:3000',
      capture: {
        routes: [
          { path: '/', name: 'home' },
          { path: '/pricing', name: 'pricing' },
          { path: '/about', name: 'about' },
        ],
        viewports: ['1280x720'],
      },
      suites: {
        critical: { routes: ['/', '/pricing'] },
        secondary: { routes: ['/about'] },
      },
    };

    // Simulate what capture.ts does: filter routes for "critical" suite, strip suites
    const filteredRoutes = fullConfig.capture.routes.filter(
      r => fullConfig.suites.critical.routes.includes(r.path),
    );

    const filteredConfig = {
      ...fullConfig,
      capture: { ...fullConfig.capture, routes: filteredRoutes },
      suites: undefined,
      testPlans: undefined,
    };

    // This should NOT throw — the filtered config is valid
    const parsed = SentinelConfigSchema.parse(filteredConfig);
    expect(parsed.capture.routes).toHaveLength(2);
    expect(parsed.suites).toBeUndefined();
  });

  it('filtered config WITH suites fails validation when suite references missing route', () => {
    const filteredConfig = {
      project: 'test',
      baseUrl: 'http://localhost:3000',
      capture: {
        routes: [
          { path: '/', name: 'home' },
          { path: '/pricing', name: 'pricing' },
        ],
        viewports: ['1280x720'],
      },
      suites: {
        critical: { routes: ['/', '/pricing'] },
        secondary: { routes: ['/about'] }, // /about was filtered out!
      },
    };

    // This SHOULD throw — secondary suite references /about which isn't in routes
    expect(() => SentinelConfigSchema.parse(filteredConfig)).toThrow();
  });
});
