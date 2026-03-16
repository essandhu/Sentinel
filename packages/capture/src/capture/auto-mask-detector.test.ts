import { describe, it, expect } from 'vitest';
import {
  identifyUnstableRegions,
  selectorsForRegions,
  buildAutoMaskRules,
} from './auto-mask-detector.js';

describe('identifyUnstableRegions', () => {
  it('finds regions where diff pixels are concentrated', () => {
    // 10x10 image, 4 bytes per pixel (RGBA), place a 3x3 red block at (2,2)
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let row = 2; row < 5; row++) {
      for (let col = 2; col < 5; col++) {
        const idx = (row * width + col) * 4;
        data[idx] = 255; // R
        data[idx + 1] = 0; // G
        data[idx + 2] = 0; // B
        data[idx + 3] = 255; // A
      }
    }
    const regions = identifyUnstableRegions(data, width, height, 1);
    expect(regions.length).toBe(1);
    expect(regions[0]).toEqual({ x: 2, y: 2, width: 3, height: 3 });
  });

  it('returns empty array for all-zero data', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);
    const regions = identifyUnstableRegions(data, width, height, 1);
    expect(regions).toEqual([]);
  });
});

describe('selectorsForRegions', () => {
  it('maps regions to overlapping DOM elements', () => {
    const regions = [{ x: 10, y: 10, width: 50, height: 50 }];
    const domPositions = [
      { selector: '#header', tagName: 'header', x: 0, y: 0, width: 100, height: 80 },
      { selector: '#footer', tagName: 'footer', x: 0, y: 500, width: 100, height: 80 },
    ];
    const selectors = selectorsForRegions(regions, domPositions);
    expect(selectors).toEqual(['#header']);
  });

  it('returns empty array for non-overlapping regions', () => {
    const regions = [{ x: 200, y: 200, width: 10, height: 10 }];
    const domPositions = [
      { selector: '#header', tagName: 'header', x: 0, y: 0, width: 100, height: 80 },
    ];
    const selectors = selectorsForRegions(regions, domPositions);
    expect(selectors).toEqual([]);
  });

  it('deduplicates selectors from multiple matching regions', () => {
    const regions = [
      { x: 10, y: 10, width: 20, height: 20 },
      { x: 30, y: 30, width: 20, height: 20 },
    ];
    const domPositions = [
      { selector: '#header', tagName: 'header', x: 0, y: 0, width: 100, height: 80 },
    ];
    const selectors = selectorsForRegions(regions, domPositions);
    expect(selectors).toEqual(['#header']);
  });
});

describe('buildAutoMaskRules', () => {
  it('converts selectors to MaskRule objects with hide strategy', () => {
    const rules = buildAutoMaskRules(['#header', '.ad-banner']);
    expect(rules).toEqual([
      { selector: '#header', strategy: 'hide' },
      { selector: '.ad-banner', strategy: 'hide' },
    ]);
  });

  it('returns empty array for empty input', () => {
    const rules = buildAutoMaskRules([]);
    expect(rules).toEqual([]);
  });
});
