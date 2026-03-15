import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { runSsimDiff } from './ssim-diff.js';

async function makePng(
  width: number,
  height: number,
  color: { r: number; g: number; b: number },
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { ...color, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

describe('runSsimDiff', () => {
  it('returns mssim close to 1.0 for identical images', async () => {
    const buf = await makePng(20, 20, { r: 255, g: 0, b: 0 });
    const result = await runSsimDiff(buf, buf);
    expect(result.skipped).toBe(false);
    expect(result.mssim).not.toBeNull();
    expect(result.mssim!).toBeGreaterThan(0.99);
  });

  it('returns mssim less than 1.0 for different images', async () => {
    const red = await makePng(20, 20, { r: 255, g: 0, b: 0 });
    const blue = await makePng(20, 20, { r: 0, g: 0, b: 255 });
    const result = await runSsimDiff(red, blue);
    expect(result.skipped).toBe(false);
    expect(result.mssim).not.toBeNull();
    expect(result.mssim!).toBeLessThan(1.0);
  });

  it('skips SSIM for images smaller than 11px in width', async () => {
    const smallW = await makePng(5, 20, { r: 255, g: 0, b: 0 });
    const result = await runSsimDiff(smallW, smallW);
    expect(result.skipped).toBe(true);
    expect(result.mssim).toBeNull();
  });

  it('skips SSIM for images smaller than 11px in height', async () => {
    const smallH = await makePng(20, 5, { r: 255, g: 0, b: 0 });
    const result = await runSsimDiff(smallH, smallH);
    expect(result.skipped).toBe(true);
    expect(result.mssim).toBeNull();
  });

  it('skips SSIM for images smaller than 11px in both dimensions', async () => {
    const small = await makePng(5, 5, { r: 255, g: 0, b: 0 });
    const result = await runSsimDiff(small, small);
    expect(result.skipped).toBe(true);
    expect(result.mssim).toBeNull();
  });
});
