import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { SentinelConfigSchema, type SentinelConfigParsed } from './config-schema.js';

export function parseConfig(raw: unknown): SentinelConfigParsed {
  return SentinelConfigSchema.parse(raw);
}

export async function loadConfig(configPath: string): Promise<SentinelConfigParsed> {
  const content = await readFile(configPath, 'utf-8');
  const raw = parse(content);
  return parseConfig(raw);
}

const DEFAULTS = {
  pixelDiffPercent: 0.1,
  ssimMin: 0.95,
} as const;

export function resolveThresholds(
  route: { thresholds?: { pixelDiffPercent?: number; ssimMin?: number } },
  breakpointThresholds?: { pixelDiffPercent?: number; ssimMin?: number },
  browserThresholds?: Record<string, { pixelDiffPercent?: number; ssimMin?: number }>,
  browserName?: string,
  globalThresholds?: { pixelDiffPercent?: number; ssimMin?: number },
): Required<{ pixelDiffPercent: number; ssimMin: number }> {
  const browserOverride = browserName ? browserThresholds?.[browserName] : undefined;
  return {
    pixelDiffPercent:
      route.thresholds?.pixelDiffPercent ??
      breakpointThresholds?.pixelDiffPercent ??
      browserOverride?.pixelDiffPercent ??
      globalThresholds?.pixelDiffPercent ??
      DEFAULTS.pixelDiffPercent,
    ssimMin:
      route.thresholds?.ssimMin ??
      breakpointThresholds?.ssimMin ??
      browserOverride?.ssimMin ??
      globalThresholds?.ssimMin ??
      DEFAULTS.ssimMin,
  };
}

export function parseViewport(viewport: string): { width: number; height: number } {
  const [width, height] = viewport.split('x').map(Number);
  return { width, height };
}
