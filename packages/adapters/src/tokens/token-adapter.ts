import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { DesignSpec, TokenValue, DesignSourceAdapter, AdapterConfig } from '@sentinel-vrt/types';
import type { DesignTokenAdapterConfig } from '../types.js';
import { normalizeColorToHex } from './color-normalize.js';

/** Maximum alias resolution depth to prevent infinite recursion. */
const MAX_ALIAS_DEPTH = 50;

/**
 * Alias pattern: a string that matches "{dotted.path}".
 */
const ALIAS_RE = /^\{([^}]+)\}$/;

/**
 * Parses a DTCG token file (JSON or YAML), flattens the token tree,
 * resolves aliases, and normalizes color values.
 */
export class DesignTokenAdapter implements DesignSourceAdapter {
  name = 'design-tokens';

  async load(config: AdapterConfig): Promise<DesignSpec> {
    const { tokenFilePath } = config as DesignTokenAdapterConfig;

    const raw = await readFile(tokenFilePath, 'utf-8');
    const ext = extname(tokenFilePath).toLowerCase();

    let tree: Record<string, unknown>;
    if (ext === '.yaml' || ext === '.yml') {
      tree = parseYaml(raw) as Record<string, unknown>;
    } else {
      tree = JSON.parse(raw) as Record<string, unknown>;
    }

    // First pass: flatten the DTCG token tree into a flat key→value record
    const flat: Record<string, TokenValue> = {};
    flattenTokenTree(tree, '', undefined, flat);

    // Second pass: resolve aliases
    const resolved = resolveAliases(flat);

    return {
      sourceType: 'tokens',
      tokens: resolved,
      metadata: {
        capturedAt: new Date().toISOString(),
      },
    };
  }

  async loadAll(config: AdapterConfig): Promise<DesignSpec[]> {
    return [await this.load(config)];
  }
}

/**
 * Recursively walks a DTCG token tree node and collects leaf tokens into `out`.
 *
 * @param node    - The current tree node (object)
 * @param prefix  - Dot-notation prefix built up during recursion (e.g. "color.brand")
 * @param groupType - The inherited $type from the nearest ancestor group, or undefined
 * @param out     - Accumulator: path → TokenValue
 */
function flattenTokenTree(
  node: Record<string, unknown>,
  prefix: string,
  groupType: string | undefined,
  out: Record<string, TokenValue>,
): void {
  for (const [key, child] of Object.entries(node)) {
    // Skip DTCG meta keys (they apply to the current node, not child tokens)
    if (key.startsWith('$')) continue;

    if (child === null || typeof child !== 'object') continue;

    const childObj = child as Record<string, unknown>;
    const path = prefix ? `${prefix}.${key}` : key;

    if ('$value' in childObj) {
      // Leaf token: extract type and value
      const type =
        typeof childObj['$type'] === 'string'
          ? childObj['$type']
          : groupType ?? 'unknown';

      const rawValue = childObj['$value'];
      const value = normalizeTokenValue(type, rawValue);

      out[path] = { type, value };
    } else {
      // Group node: recurse, propagating this group's $type (if any)
      const nextGroupType =
        typeof childObj['$type'] === 'string' ? childObj['$type'] : groupType;

      flattenTokenTree(childObj, path, nextGroupType, out);
    }
  }
}

/**
 * Applies type-specific normalization to a token value.
 * Color tokens are converted to lowercase 6-digit sRGB hex.
 */
function normalizeTokenValue(type: string, rawValue: unknown): string | number {
  if (type === 'color') {
    if (typeof rawValue === 'string') {
      return normalizeColorToHex(rawValue);
    }
    if (rawValue !== null && typeof rawValue === 'object') {
      return normalizeColorToHex(rawValue as Record<string, unknown>);
    }
  }

  if (typeof rawValue === 'string') return rawValue;
  if (typeof rawValue === 'number') return rawValue;
  return String(rawValue);
}

/**
 * Resolves alias tokens (`{dotted.path}` strings) to their final values.
 * Handles chains (A→B→C) and detects circular references.
 *
 * @throws Error on circular aliases or unresolvable references.
 */
function resolveAliases(tokens: Record<string, TokenValue>): Record<string, TokenValue> {
  const resolved: Record<string, TokenValue> = {};

  for (const path of Object.keys(tokens)) {
    resolved[path] = resolveToken(path, tokens, [], 0);
  }

  return resolved;
}

function resolveToken(
  path: string,
  tokens: Record<string, TokenValue>,
  chain: string[],
  depth: number,
): TokenValue {
  if (depth > MAX_ALIAS_DEPTH) {
    throw new Error(
      `Token alias depth exceeded ${MAX_ALIAS_DEPTH} levels at "${path}" (chain: ${chain.join(' → ')})`,
    );
  }

  const token = tokens[path];
  if (!token) {
    throw new Error(
      `Token alias target "${path}" does not exist (referenced from: ${chain.join(' → ')})`,
    );
  }

  const value = token.value;
  if (typeof value !== 'string') return token;

  const aliasMatch = ALIAS_RE.exec(value);
  if (!aliasMatch) return token;

  const targetPath = aliasMatch[1];

  // Circular reference check
  if (chain.includes(targetPath)) {
    throw new Error(
      `Circular token alias detected: ${[...chain, targetPath].join(' → ')}`,
    );
  }

  // Resolve the target recursively
  const target = resolveToken(targetPath, tokens, [...chain, path], depth + 1);
  return { type: token.type, value: target.value };
}
