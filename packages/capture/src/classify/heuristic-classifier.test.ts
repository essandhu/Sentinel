import { describe, it, expect } from 'vitest';
import { classifyRegions, classifySingleRegion, type Classification, type ChangeCategory } from './heuristic-classifier.js';
import type { Region } from './connected-components.js';

/**
 * Helper: create a Region with a given bounding box and pixel density.
 */
function makeRegion(
  id: number,
  x: number,
  y: number,
  width: number,
  height: number,
  density: number = 1.0,
): Region {
  const pixelCount = Math.round(width * height * density);
  return {
    id,
    pixels: [], // Not needed for classification
    boundingBox: { x, y, width, height },
    pixelCount,
  };
}

describe('classifyRegions', () => {
  const imageWidth = 1000;
  const imageHeight = 800;

  it('returns "layout" for one large region spanning >30% of image', () => {
    // Region covering ~40% of image, edge-aligned at top-left
    const region = makeRegion(0, 0, 0, 800, 400, 0.8);
    const result = classifyRegions([region], imageWidth, imageHeight);
    expect(result.category).toBe('layout');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });

  it('returns "style" for many small scattered regions', () => {
    // 12 small regions scattered across the image, each 50x50 for sufficient coverage (>2%)
    // Total changed pixels: 12 * 50 * 50 * 0.8 = 24000 / 800000 = 3% coverage
    const regions: Region[] = [];
    for (let i = 0; i < 12; i++) {
      regions.push(makeRegion(i, (i * 80) % 900, (i * 60) % 700, 50, 50, 0.8));
    }
    const result = classifyRegions(regions, imageWidth, imageHeight);
    expect(result.category).toBe('style');
  });

  it('returns "content" for mid-sized dense rectangular region', () => {
    // A dense rectangular region ~5% of image (text block change)
    const region = makeRegion(0, 100, 200, 200, 200, 0.8);
    const result = classifyRegions(regions(), imageWidth, imageHeight);
    expect(result.category).toBe('content');

    function regions() {
      return [region];
    }
  });

  it('returns "cosmetic" for tiny changes (<2% coverage)', () => {
    // Two very small regions with minimal coverage
    const regions = [
      makeRegion(0, 500, 400, 8, 8, 1.0),
      makeRegion(1, 200, 100, 6, 6, 1.0),
    ];
    const result = classifyRegions(regions, imageWidth, imageHeight);
    expect(result.category).toBe('cosmetic');
  });

  it('reduces confidence when top two categories score similarly', () => {
    // Ambiguous case: 6 dense rectangular regions that qualify as content
    // (density>0.6, relArea in 0.01-0.15) AND also trigger style (>5 regions, coverage>2%)
    // Each 100x100: relArea = 10000/800000 = 0.0125 (in content band 0.01-0.15)
    // Total coverage = 6 * 100*100*0.8 / 800000 = 0.06 (>2% for style)
    const regions: Region[] = [];
    for (let i = 0; i < 6; i++) {
      regions.push(makeRegion(i, 50 + i * 140, 200 + (i % 3) * 150, 100, 100, 0.8));
    }
    const result = classifyRegions(regions, imageWidth, imageHeight);
    // Both style and content should score, reducing confidence
    expect(result.confidence).toBeLessThanOrEqual(0.85);
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
  });

  it('never exceeds 0.95 confidence', () => {
    // Very clear layout change -- huge region, edge-aligned, massive coverage
    const region = makeRegion(0, 0, 0, 1000, 800, 1.0);
    const result = classifyRegions([region], imageWidth, imageHeight);
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });

  it('returns reasons array with human-readable strings', () => {
    const region = makeRegion(0, 0, 0, 800, 400, 0.8);
    const result = classifyRegions([region], imageWidth, imageHeight);
    expect(result.reasons).toBeInstanceOf(Array);
    expect(result.reasons.length).toBeGreaterThan(0);
    for (const reason of result.reasons) {
      expect(typeof reason).toBe('string');
    }
  });
});

describe('classifySingleRegion', () => {
  const imageWidth = 1000;
  const imageHeight = 800;

  it('returns "layout" for a large edge-aligned region (>5% area)', () => {
    // Large region at left edge: 300x400 = 120000px, image = 800000px => 15% area
    const region = makeRegion(0, 0, 100, 300, 400, 0.8);
    const result = classifySingleRegion(region, imageWidth, imageHeight);
    expect(result.category).toBe('layout');
  });

  it('returns "content" for a dense mid-size region', () => {
    // Dense rectangular region: 100x80 = 8000px, image = 800000px => 1% area, density 0.8
    const region = makeRegion(0, 300, 300, 100, 80, 0.8);
    const result = classifySingleRegion(region, imageWidth, imageHeight);
    expect(result.category).toBe('content');
  });

  it('returns "cosmetic" for a tiny region (<0.5% area)', () => {
    // Tiny region: 10x10 = 100px, image = 800000px => 0.0125% area
    const region = makeRegion(0, 500, 400, 10, 10, 1.0);
    const result = classifySingleRegion(region, imageWidth, imageHeight);
    expect(result.category).toBe('cosmetic');
  });

  it('returns confidence between 0.3 and 0.95', () => {
    const region = makeRegion(0, 0, 0, 300, 400, 0.8);
    const result = classifySingleRegion(region, imageWidth, imageHeight);
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });

  it('returns a spatialZone', () => {
    const region = makeRegion(0, 0, 0, 800, 100, 0.8);
    const result = classifySingleRegion(region, imageWidth, imageHeight);
    expect(['header', 'sidebar', 'content', 'footer', 'full-width']).toContain(result.spatialZone);
  });
});
