import { describe, it, expect } from 'vitest';
import { SentinelConfigSchema, PluginConfigSchema } from './config-schema.js';

describe('PluginConfigSchema', () => {
  it('accepts enabled flag with default true', () => {
    const result = PluginConfigSchema.parse({});
    expect(result.enabled).toBe(true);
  });

  it('accepts config record', () => {
    const result = PluginConfigSchema.parse({
      enabled: true,
      config: { webhookUrl: 'https://example.com', channel: '#test' },
    });
    expect(result.config).toEqual({ webhookUrl: 'https://example.com', channel: '#test' });
  });

  it('accepts disabled plugin', () => {
    const result = PluginConfigSchema.parse({ enabled: false });
    expect(result.enabled).toBe(false);
  });
});

describe('SentinelConfigSchema plugins section', () => {
  const baseConfig = {
    project: 'test-project',
    baseUrl: 'http://localhost:3000',
    capture: {
      routes: [{ path: '/', name: 'home' }],
    },
  };

  it('accepts config without plugins section', () => {
    const result = SentinelConfigSchema.parse(baseConfig);
    expect(result.plugins).toBeUndefined();
  });

  it('accepts config with plugins section', () => {
    const result = SentinelConfigSchema.parse({
      ...baseConfig,
      plugins: {
        'sentinel-plugin-teams-notify': {
          enabled: true,
          config: { webhookUrl: 'https://example.com' },
        },
        'sentinel-plugin-perceptual-diff': {
          enabled: false,
        },
      },
    });
    expect(result.plugins).toBeDefined();
    expect(result.plugins!['sentinel-plugin-teams-notify'].enabled).toBe(true);
    expect(result.plugins!['sentinel-plugin-perceptual-diff'].enabled).toBe(false);
  });

  it('defaults enabled to true when not specified', () => {
    const result = SentinelConfigSchema.parse({
      ...baseConfig,
      plugins: {
        'sentinel-plugin-foo': {
          config: { key: 'value' },
        },
      },
    });
    expect(result.plugins!['sentinel-plugin-foo'].enabled).toBe(true);
  });
});
