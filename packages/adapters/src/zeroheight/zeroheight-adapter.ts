import type { DesignSourceAdapter, DesignSpec, AdapterConfig, TokenValue } from '@sentinel-vrt/types';
import { fetchTokenExport } from './zeroheight-client.js';
import { normalizeColorToHex } from '../tokens/color-normalize.js';

export interface ZeroheightAdapterConfig extends AdapterConfig {
  orgUrl: string;
  tokenSetId: string;
  clientId: string;
  accessToken: string;
}

/**
 * ZeroheightAdapter implements DesignSourceAdapter for Zeroheight's
 * Design Token Manager. Fetches token exports via API and maps them
 * to Sentinel's TokenValue format for CSS verification.
 *
 * Uses sourceType 'tokens' to reuse existing token comparison pipeline.
 */
export class ZeroheightAdapter implements DesignSourceAdapter {
  readonly name = 'zeroheight';

  async loadAll(config: AdapterConfig): Promise<DesignSpec[]> {
    const {
      orgUrl,
      tokenSetId,
      clientId,
      accessToken,
    } = config as ZeroheightAdapterConfig;

    const rawExport = await fetchTokenExport(orgUrl, tokenSetId, clientId, accessToken);
    const tokens = mapZeroheightTokens(rawExport);

    return [{
      sourceType: 'tokens',
      tokens,
      metadata: {
        capturedAt: new Date().toISOString(),
      },
    }];
  }

  async load(config: AdapterConfig): Promise<DesignSpec> {
    const specs = await this.loadAll(config);
    if (specs.length === 0) {
      throw new Error('No Zeroheight token sets could be exported');
    }
    return specs[0];
  }
}

/**
 * Maps a Zeroheight JSON token export to Sentinel's TokenValue format.
 *
 * Handles two formats:
 * 1. DTCG-style: values are objects with $value and $type keys
 * 2. Flat format: values are plain strings or numbers
 */
export function mapZeroheightTokens(
  rawExport: Record<string, unknown>,
): Record<string, TokenValue> {
  const tokens: Record<string, TokenValue> = {};

  for (const [key, value] of Object.entries(rawExport)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      '$value' in (value as Record<string, unknown>) &&
      '$type' in (value as Record<string, unknown>)
    ) {
      // DTCG format: { $value: ..., $type: ... }
      const dtcg = value as { $value: string | number; $type: string };
      const tokenType = dtcg.$type;
      const tokenValue = tokenType === 'color' && typeof dtcg.$value === 'string'
        ? normalizeColorToHex(dtcg.$value)
        : dtcg.$value;
      tokens[key] = { type: tokenType, value: tokenValue };
    } else if (typeof value === 'string') {
      const tokenType = detectTokenType(value);
      const tokenValue = tokenType === 'color'
        ? normalizeColorToHex(value)
        : value;
      tokens[key] = { type: tokenType, value: tokenValue };
    } else if (typeof value === 'number') {
      tokens[key] = { type: 'number', value };
    }
  }

  return tokens;
}

/**
 * Detects token type from a string value based on common patterns.
 */
function detectTokenType(value: string): string {
  if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) {
    return 'color';
  }
  if (value.endsWith('px') || value.endsWith('rem') || value.endsWith('em')) {
    return 'dimension';
  }
  return 'unknown';
}
