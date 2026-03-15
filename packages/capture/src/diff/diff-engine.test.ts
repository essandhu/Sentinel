import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { runDualDiff, DiffThresholds } from './diff-engine.js';

const DEFAULT_THRESHOLDS: DiffThresholds = {
  pixelDiffPercent: 0.1,
  ssimMin: 0.95,
};

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

describe('runDualDiff', () => {
  it('returns passed=true and zero pixelDiffPercent for identical images', async () => {
    const buf = await makePng(20, 20, { r: 255, g: 0, b: 0 });
    const result = await runDualDiff(buf, buf, DEFAULT_THRESHOLDS);
    expect(result.passed).toBe(true);
    expect(result.pixelDiffPercent).toBe(0);
    expect(result.ssimScore).not.toBeNull();
    expect(result.ssimScore!).toBeGreaterThan(0.99);
    expect(result.diffImageBuffer).toBeInstanceOf(Buffer);
  });

  it('returns passed=false for clearly different images when both layers fail', async () => {
    const red = await makePng(20, 20, { r: 255, g: 0, b: 0 });
    const blue = await makePng(20, 20, { r: 0, g: 0, b: 255 });
    // Use loose thresholds to ensure both pixel AND ssim fail simultaneously
    const thresholds: DiffThresholds = { pixelDiffPercent: 0.1, ssimMin: 0.99 };
    const result = await runDualDiff(red, blue, thresholds);
    expect(result.passed).toBe(false);
    expect(result.pixelDiffPercent).toBeGreaterThan(0);
  });

  it('returns passed=true when pixel diff is below threshold (both must fail)', async () => {
    const buf = await makePng(20, 20, { r: 255, g: 0, b: 0 });
    // Identical images -> pixel diff = 0, which is below any threshold -> passed=true
    const thresholds: DiffThresholds = { pixelDiffPercent: 0.1, ssimMin: 0.999 };
    const result = await runDualDiff(buf, buf, thresholds);
    expect(result.passed).toBe(true);
  });

  it('returns passed=true when pixel fails but SSIM passes (SSIM saves it)', async () => {
    // Nearly identical large images: 1 pixel changed on edge
    // Use a red image and modify to have very slight color change
    const red = await makePng(20, 20, { r: 255, g: 0, b: 0 });
    const slightlyDifferent = await makePng(20, 20, { r: 254, g: 0, b: 0 });
    // SSIM for nearly-same images should be high (>0.95), pixel diff may vary
    // Use a very tight pixel threshold to force pixel failure, but normal ssim threshold
    const thresholds: DiffThresholds = { pixelDiffPercent: 0.0, ssimMin: 0.5 };
    const result = await runDualDiff(red, slightlyDifferent, thresholds);
    // If SSIM > 0.5, passed should be true even if pixel failed
    // For nearly identical images, SSIM will be very high
    expect(result.passed).toBe(true);
  });

  it('uses pixel diff only for small images (SSIM skipped), ssimScore is null', async () => {
    const small = await makePng(5, 5, { r: 255, g: 0, b: 0 });
    const result = await runDualDiff(small, small, DEFAULT_THRESHOLDS);
    expect(result.ssimScore).toBeNull();
    expect(result.passed).toBe(true); // identical images always pass
  });

  it('returns passed=false for different small images when pixel diff fails', async () => {
    const red = await makePng(5, 5, { r: 255, g: 0, b: 0 });
    const blue = await makePng(5, 5, { r: 0, g: 0, b: 255 });
    const result = await runDualDiff(red, blue, DEFAULT_THRESHOLDS);
    expect(result.ssimScore).toBeNull(); // SSIM skipped for 5x5
    expect(result.passed).toBe(false);
  });

  it('includes correct layers shape in DiffResult', async () => {
    const buf = await makePng(20, 20, { r: 255, g: 0, b: 0 });
    const result = await runDualDiff(buf, buf, DEFAULT_THRESHOLDS);
    expect(result.layers).toBeDefined();
    expect(result.layers.pixel).toBeDefined();
    expect(typeof result.layers.pixel.diffPercent).toBe('number');
    expect(typeof result.layers.pixel.diffPixelCount).toBe('number');
    // SSIM layer present for images >= 11px
    expect(result.layers.ssim).toBeDefined();
    expect(typeof result.layers.ssim!.score).toBe('number');
  });

  it('does not include ssim layer for small images', async () => {
    const small = await makePng(5, 5, { r: 255, g: 0, b: 0 });
    const result = await runDualDiff(small, small, DEFAULT_THRESHOLDS);
    expect(result.layers.ssim).toBeUndefined();
  });
});
