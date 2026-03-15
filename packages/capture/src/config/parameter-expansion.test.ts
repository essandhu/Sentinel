import { describe, it, expect } from 'vitest';
import { ParameterDimensionSchema, RouteSchema, SentinelConfigSchema } from './config-schema.js';
import { expandParameterMatrix, type ExpandedRoute, type ExpansionResult } from './parameter-expansion.js';

describe('ParameterDimensionSchema', () => {
  it('accepts { values: ["light", "dark"] }', () => {
    const result = ParameterDimensionSchema.safeParse({ values: ['light', 'dark'] });
    expect(result.success).toBe(true);
  });

  it('rejects { values: [] }', () => {
    const result = ParameterDimensionSchema.safeParse({ values: [] });
    expect(result.success).toBe(false);
  });

  it('rejects values with empty strings', () => {
    const result = ParameterDimensionSchema.safeParse({ values: [''] });
    expect(result.success).toBe(false);
  });
});

describe('RouteSchema with parameters', () => {
  it('accepts route with parameters map', () => {
    const result = RouteSchema.safeParse({
      path: '/home',
      name: 'home',
      parameters: {
        theme: { values: ['light', 'dark'] },
        locale: { values: ['en', 'fr'] },
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts route without parameters', () => {
    const result = RouteSchema.safeParse({
      path: '/about',
      name: 'about',
    });
    expect(result.success).toBe(true);
  });
});

describe('SentinelConfigSchema maxCapturesPerRun', () => {
  it('accepts maxCapturesPerRun and defaults to 500', () => {
    const result = SentinelConfigSchema.safeParse({
      project: 'test',
      baseUrl: 'http://localhost:3000',
      capture: {
        routes: [{ path: '/home', name: 'home' }],
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxCapturesPerRun).toBe(500);
    }
  });

  it('accepts explicit maxCapturesPerRun value', () => {
    const result = SentinelConfigSchema.safeParse({
      project: 'test',
      baseUrl: 'http://localhost:3000',
      capture: {
        routes: [{ path: '/home', name: 'home' }],
      },
      maxCapturesPerRun: 100,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxCapturesPerRun).toBe(100);
    }
  });
});

describe('expandParameterMatrix', () => {
  it('with 1 route, 2 themes, 3 locales produces 6 expanded routes', () => {
    const routes = [
      {
        path: '/home',
        name: 'home',
        parameters: {
          theme: { values: ['light', 'dark'] },
          locale: { values: ['en', 'fr', 'de'] },
        },
      },
    ];
    const result = expandParameterMatrix(routes, 1, 1);
    expect(result.routes).toHaveLength(6);
    expect(result.totalCaptures).toBe(6);
    expect(result.truncated).toBe(false);
  });

  it('with no parameters passes route through with parameterName=null', () => {
    const routes = [
      { path: '/about', name: 'about' },
    ];
    const result = expandParameterMatrix(routes, 1, 1);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].parameterName).toBeNull();
    expect(result.routes[0].parameterValues).toEqual({});
  });

  it('produces deterministic parameterName with sorted keys', () => {
    const routes = [
      {
        path: '/home',
        name: 'home',
        parameters: {
          theme: { values: ['dark'] },
          locale: { values: ['en'] },
        },
      },
    ];
    const result = expandParameterMatrix(routes, 1, 1);
    // Keys sorted: locale, theme -> values: en, dark -> "en|dark"
    expect(result.routes[0].parameterName).toBe('en|dark');
  });

  it('maxCapturesPerRun truncates and sets truncated=true with truncatedAt', () => {
    const routes = [
      {
        path: '/home',
        name: 'home',
        parameters: {
          theme: { values: ['light', 'dark'] },
          locale: { values: ['en', 'fr', 'de'] },
        },
      },
    ];
    // 6 expanded routes * 2 viewports * 1 browser = 12 captures, limit to 4
    // That means max 4 / (2*1) = 2 routes allowed
    const result = expandParameterMatrix(routes, 2, 1, 4);
    expect(result.truncated).toBe(true);
    expect(result.truncatedAt).toBeDefined();
    expect(result.routes.length).toBeLessThan(6);
  });

  it('empty parameter dimensions treated as no-params', () => {
    const routes = [
      { path: '/home', name: 'home', parameters: {} },
    ];
    const result = expandParameterMatrix(routes, 1, 1);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].parameterName).toBeNull();
    expect(result.routes[0].parameterValues).toEqual({});
  });

  it('single dimension with single value produces 1 expanded route', () => {
    const routes = [
      {
        path: '/home',
        name: 'home',
        parameters: {
          theme: { values: ['light'] },
        },
      },
    ];
    const result = expandParameterMatrix(routes, 1, 1);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].parameterName).toBe('light');
    expect(result.routes[0].parameterValues).toEqual({ theme: 'light' });
  });

  it('preserves route properties (viewports, mask, thresholds) on expanded routes', () => {
    const routes = [
      {
        path: '/home',
        name: 'home',
        viewports: ['1920x1080'],
        mask: ['.ad-banner'],
        parameters: {
          theme: { values: ['light', 'dark'] },
        },
      },
    ];
    const result = expandParameterMatrix(routes, 1, 1);
    expect(result.routes).toHaveLength(2);
    for (const route of result.routes) {
      expect(route.viewports).toEqual(['1920x1080']);
      expect(route.mask).toEqual(['.ad-banner']);
    }
  });
});
