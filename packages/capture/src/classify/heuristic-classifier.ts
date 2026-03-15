import type { Region } from './connected-components.js';
import { extractFeatures, deriveSpatialZone, type SpatialZone } from './region-features.js';

export type ChangeCategory = 'layout' | 'style' | 'content' | 'cosmetic';

export interface Classification {
  category: ChangeCategory;
  confidence: number; // 0-1
  reasons: string[];
  regions: Region[];
}

/**
 * Classify detected change regions into a category using spatial heuristics.
 *
 * Categories:
 * - layout: Large structural changes, edge-aligned, high coverage
 * - content: Mid-sized dense rectangular regions (text/image block changes)
 * - style: Many diffuse regions scattered across the image (color/font changes)
 * - cosmetic: Very small changes, minimal pixel coverage
 *
 * Confidence reflects the separation between the top two scoring categories,
 * clamped to [0.3, 0.95].
 */
export function classifyRegions(
  regions: Region[],
  imageWidth: number,
  imageHeight: number,
): Classification {
  const totalPixels = imageWidth * imageHeight;
  const totalChangedPixels = regions.reduce((sum, r) => sum + r.pixelCount, 0);
  const changeCoverage = totalChangedPixels / totalPixels;

  const features = regions.map((r) => extractFeatures(r, imageWidth, imageHeight));

  // Count large regions (bounding box > 5% of image area)
  const largeRegions = regions.filter(
    (r) => (r.boundingBox.width * r.boundingBox.height) / totalPixels > 0.05,
  );

  // Count edge-aligned regions
  const edgeAlignedRegions = features.filter((f) => f.isEdgeAligned);

  // Count dense rectangular regions (content candidates)
  const denseRectangular = regions.filter((r) => {
    const area = r.boundingBox.width * r.boundingBox.height;
    const density = r.pixelCount / area;
    const relArea = area / totalPixels;
    return density > 0.6 && relArea > 0.01 && relArea < 0.15;
  });

  // Score each category
  const scores: Record<ChangeCategory, number> = {
    layout: 0,
    content: 0,
    style: 0,
    cosmetic: 0,
  };

  // LAYOUT: Large structural changes, edge-aligned, high coverage
  if (largeRegions.length > 0 && changeCoverage > 0.1) scores.layout += 0.6;
  if (edgeAlignedRegions.length > 1) scores.layout += 0.3;
  if (changeCoverage > 0.3) scores.layout += 0.2;
  if (largeRegions.length > 0 && edgeAlignedRegions.length > 0) scores.layout += 0.1;

  // CONTENT: Mid-sized dense rectangular regions (text changes)
  if (denseRectangular.length > 0) scores.content += 0.5;
  if (denseRectangular.length > 2) scores.content += 0.2;
  if (changeCoverage > 0.01 && changeCoverage < 0.15 && regions.length <= 5)
    scores.content += 0.15;

  // STYLE: Many diffuse regions, moderate coverage
  if (regions.length > 5 && changeCoverage > 0.02) scores.style += 0.4;
  if (regions.length > 10) scores.style += 0.3;
  if (regions.length > 5 && changeCoverage < 0.1) scores.style += 0.1;

  // COSMETIC: Very small changes, few pixels
  if (changeCoverage < 0.02) scores.cosmetic += 0.6;
  if (regions.length <= 3 && changeCoverage < 0.05) scores.cosmetic += 0.3;

  // Pick winner
  const entries = Object.entries(scores) as [ChangeCategory, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [bestCategory, bestScore] = entries[0];
  const [, secondScore] = entries[1];

  // Confidence: separation between top two categories
  const separation = bestScore - secondScore;
  const confidence = Math.min(0.95, Math.max(0.3, 0.5 + separation));

  return {
    category: bestCategory,
    confidence,
    reasons: buildReasons(bestCategory, regions, changeCoverage, imageWidth, imageHeight),
    regions,
  };
}

/**
 * Build human-readable explanation strings for a classification.
 */
function buildReasons(
  category: ChangeCategory,
  regions: Region[],
  changeCoverage: number,
  imageWidth: number,
  imageHeight: number,
): string[] {
  const reasons: string[] = [];
  const totalPixels = imageWidth * imageHeight;
  const coveragePct = (changeCoverage * 100).toFixed(1);

  reasons.push(`${regions.length} change region(s) detected`);
  reasons.push(`${coveragePct}% of image area affected`);

  switch (category) {
    case 'layout':
      reasons.push('Large structural changes detected');
      if (regions.some((r) => {
        const f = extractFeatures(r, imageWidth, imageHeight);
        return f.isEdgeAligned;
      })) {
        reasons.push('Changes aligned with image edges (structural shift)');
      }
      break;
    case 'content':
      reasons.push('Mid-sized dense change regions (likely text or image block)');
      break;
    case 'style':
      reasons.push('Multiple scattered changes across the page');
      if (regions.length > 10) {
        reasons.push(`High region count (${regions.length}) suggests global style change`);
      }
      break;
    case 'cosmetic':
      reasons.push('Minimal visual changes detected');
      break;
  }

  return reasons;
}

/**
 * Classify a single region independently using spatial heuristics.
 * Returns the most likely category, confidence, and spatial zone for the region.
 */
export function classifySingleRegion(
  region: Region,
  imageWidth: number,
  imageHeight: number,
): { category: ChangeCategory; confidence: number; spatialZone: SpatialZone } {
  const features = extractFeatures(region, imageWidth, imageHeight);
  const totalPixels = imageWidth * imageHeight;
  const relArea = (region.boundingBox.width * region.boundingBox.height) / totalPixels;

  const scores: Record<ChangeCategory, number> = {
    layout: 0,
    content: 0,
    style: 0,
    cosmetic: 0,
  };

  // LAYOUT: large edge-aligned region
  if (relArea > 0.05 && features.isEdgeAligned) scores.layout += 0.7;
  if (features.verticalSpan > 0.3) scores.layout += 0.2;

  // CONTENT: dense mid-size region
  if (features.density > 0.6 && relArea > 0.01 && relArea < 0.15) scores.content += 0.6;
  if (features.aspectRatio >= 0.3 && features.aspectRatio <= 5) scores.content += 0.1;

  // STYLE: diffuse region with low density
  if (features.density < 0.3 && relArea > 0.02) scores.style += 0.5;

  // COSMETIC: tiny region
  if (relArea < 0.005) scores.cosmetic += 0.7;
  if (region.pixelCount < 100) scores.cosmetic += 0.2;

  // Pick winner
  const entries = Object.entries(scores) as [ChangeCategory, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [bestCategory, bestScore] = entries[0];
  const [, secondScore] = entries[1];

  const separation = bestScore - secondScore;
  const confidence = Math.min(0.95, Math.max(0.3, 0.5 + separation));

  const spatialZone = deriveSpatialZone(
    features.relativeX,
    features.relativeY,
    features.relativeWidth,
    features.relativeHeight,
  );

  return { category: bestCategory, confidence, spatialZone };
}
