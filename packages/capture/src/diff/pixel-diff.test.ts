import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { runPixelDiff } from './pixel-diff.js';

async function makeRedPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function makeBluePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

describe('runPixelDiff', () => {
  it('returns zero diff stats for identical images', async () => {
    const buf = await makeRedPng(10, 10);
    const result = await runPixelDiff(buf, buf);
    expect(result.diffPixelCount).toBe(0);
    expect(result.diffPercent).toBe(0);
    expect(result.diffImageBuffer).toBeInstanceOf(Buffer);
    expect(result.diffImageBuffer.length).toBeGreaterThan(0);
  });

  it('returns non-zero diff stats for different images', async () => {
    const red = await makeRedPng(10, 10);
    const blue = await makeBluePng(10, 10);
    const result = await runPixelDiff(red, blue);
    expect(result.diffPixelCount).toBeGreaterThan(0);
    expect(result.diffPercent).toBeGreaterThan(0);
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
  });

  it('normalizes mismatched dimensions to the larger size', async () => {
    const small = await makeRedPng(10, 10);
    const large = await makeRedPng(20, 20);
    const result = await runPixelDiff(small, large);
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
    expect(result.diffPixelCount).toBeGreaterThan(0);
  });

  it('respects custom threshold option', async () => {
    // With threshold=0, even very slight differences fail; with threshold=1, almost nothing fails
    const red1 = await makeRedPng(10, 10);
    const red2 = await makeRedPng(10, 10);
    // Identical images should always produce 0 regardless of threshold
    const result = await runPixelDiff(red1, red2, { threshold: 0 });
    expect(result.diffPixelCount).toBe(0);
  });

  it('returns a valid PNG buffer as diffImageBuffer', async () => {
    const red = await makeRedPng(10, 10);
    const blue = await makeBluePng(10, 10);
    const result = await runPixelDiff(red, blue);
    // PNG magic bytes: 89 50 4E 47
    expect(result.diffImageBuffer[0]).toBe(0x89);
    expect(result.diffImageBuffer[1]).toBe(0x50); // P
    expect(result.diffImageBuffer[2]).toBe(0x4e); // N
    expect(result.diffImageBuffer[3]).toBe(0x47); // G
  });
});
