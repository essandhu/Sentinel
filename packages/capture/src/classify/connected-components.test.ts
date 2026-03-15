import { describe, it, expect } from 'vitest';
import { findConnectedComponents, type Region } from './connected-components.js';

/**
 * Helper: create a blank RGBA image buffer (all black/transparent = no changes).
 */
function createBlankImage(width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height * 4);
}

/**
 * Helper: paint a solid red rectangle on an RGBA buffer.
 * Red pixels (R=255, G=0, B=0, A=255) simulate pixelmatch diff output.
 */
function paintRedRect(
  data: Uint8ClampedArray,
  imageWidth: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): void {
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const offset = (y * imageWidth + x) * 4;
      data[offset] = 255;     // R
      data[offset + 1] = 0;   // G
      data[offset + 2] = 0;   // B
      data[offset + 3] = 255; // A
    }
  }
}

describe('findConnectedComponents', () => {
  it('returns empty array for an all-black (no changes) image', () => {
    const data = createBlankImage(100, 100);
    const regions = findConnectedComponents(data, 100, 100);
    expect(regions).toEqual([]);
  });

  it('returns 1 region for a single 20x20 red square with correct bounding box', () => {
    const width = 100;
    const height = 100;
    const data = createBlankImage(width, height);
    paintRedRect(data, width, 10, 10, 20, 20);

    const regions = findConnectedComponents(data, width, height);
    expect(regions).toHaveLength(1);
    expect(regions[0].boundingBox).toEqual({ x: 10, y: 10, width: 20, height: 20 });
    expect(regions[0].pixelCount).toBe(400);
  });

  it('filters regions below minPixels threshold', () => {
    const width = 100;
    const height = 100;
    const data = createBlankImage(width, height);
    // Paint a 2x2 red square = 4 pixels
    paintRedRect(data, width, 50, 50, 2, 2);

    const regions = findConnectedComponents(data, width, height, 10);
    expect(regions).toHaveLength(0);

    // With minPixels=3, the 4-pixel region should be included
    const regionsLow = findConnectedComponents(data, width, height, 3);
    expect(regionsLow).toHaveLength(1);
  });

  it('returns 2 regions for two separate red rectangles', () => {
    const width = 200;
    const height = 100;
    const data = createBlankImage(width, height);
    // Two rectangles far apart (no adjacency)
    paintRedRect(data, width, 10, 10, 20, 20);
    paintRedRect(data, width, 150, 50, 30, 30);

    const regions = findConnectedComponents(data, width, height);
    expect(regions).toHaveLength(2);
  });

  it('produces correct bounding box x, y, width, height', () => {
    const width = 200;
    const height = 200;
    const data = createBlankImage(width, height);
    paintRedRect(data, width, 30, 40, 50, 60);

    const regions = findConnectedComponents(data, width, height);
    expect(regions).toHaveLength(1);
    const bb = regions[0].boundingBox;
    expect(bb.x).toBe(30);
    expect(bb.y).toBe(40);
    expect(bb.width).toBe(50);
    expect(bb.height).toBe(60);
  });
});
