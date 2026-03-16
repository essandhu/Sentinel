import type { DiscoveredDesignImage } from './design-drift-matcher.js';

export interface CaptureForDrift { routeName: string; routePath: string; viewport: string; screenshotBuffer: Buffer; }
export interface DriftComparison { routeName: string; routePath: string; viewport: string; designPath: string; screenshotBuffer: Buffer; }
export interface DriftResult { routeName: string; routePath: string; viewport: string; designPath: string; pixelDiffPercent: number; ssimScore: number | null; passed: boolean; diffImageBuffer: Buffer; }

export const buildDriftComparisons = (captures: CaptureForDrift[], designImages: DiscoveredDesignImage[]): DriftComparison[] => {
  const designMap = new Map<string, DiscoveredDesignImage>();
  for (const img of designImages) designMap.set(`${img.routeName}|${img.viewport}`, img);
  const comparisons: DriftComparison[] = [];
  for (const capture of captures) {
    const design = designMap.get(`${capture.routeName}|${capture.viewport}`);
    if (design) comparisons.push({ routeName: capture.routeName, routePath: capture.routePath, viewport: capture.viewport, designPath: design.filePath, screenshotBuffer: capture.screenshotBuffer });
  }
  return comparisons;
};
