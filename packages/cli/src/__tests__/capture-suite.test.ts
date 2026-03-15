import { describe, it, expect } from 'vitest';
import { filterRoutesBySuite } from '../commands/capture-remote.js';
import type { SentinelConfigParsed } from '@sentinel/capture';

function makeConfig(overrides: Partial<SentinelConfigParsed> = {}): SentinelConfigParsed {
  return {
    project: 'test',
    baseUrl: 'http://localhost:3000',
    browsers: ['chromium'],
    capture: {
      routes: [
        { path: '/', name: 'home' },
        { path: '/login', name: 'login' },
        { path: '/dashboard', name: 'dashboard' },
      ],
      viewports: ['1280x720'],
    },
    ...overrides,
  } as SentinelConfigParsed;
}

describe('filterRoutesBySuite', () => {
  it('returns only routes matching the suite route paths', () => {
    const config = makeConfig({
      suites: { smoke: { routes: ['/', '/login'] } },
    } as any);
    const filtered = filterRoutesBySuite(config, 'smoke');
    expect(filtered.capture.routes).toHaveLength(2);
    expect(filtered.capture.routes.map((r) => r.path)).toEqual(['/', '/login']);
  });

  it('throws if suite name not found in config', () => {
    const config = makeConfig({
      suites: { smoke: { routes: ['/'] } },
    } as any);
    expect(() => filterRoutesBySuite(config, 'nonexistent')).toThrow(
      'Suite "nonexistent" is not defined in config',
    );
  });

  it('throws if suite has no matching routes', () => {
    const config = makeConfig({
      suites: { empty: { routes: ['/not-in-routes'] } },
    } as any);
    expect(() => filterRoutesBySuite(config, 'empty')).toThrow(
      'Suite "empty" has no matching routes',
    );
  });

  it('throws when config has no suites defined', () => {
    const config = makeConfig();
    expect(() => filterRoutesBySuite(config, 'smoke')).toThrow(
      'Suite "smoke" is not defined in config',
    );
  });

  it('preserves other config fields when filtering', () => {
    const config = makeConfig({
      suites: { smoke: { routes: ['/'] } },
    } as any);
    const filtered = filterRoutesBySuite(config, 'smoke');
    expect(filtered.project).toBe('test');
    expect(filtered.baseUrl).toBe('http://localhost:3000');
    expect(filtered.capture.viewports).toEqual(['1280x720']);
  });
});
