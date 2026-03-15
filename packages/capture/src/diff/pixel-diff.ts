import sharp from 'sharp';
import pixelmatch from 'pixelmatch';

export interface PixelDiffResult {
  diffPixelCount: number;
  diffPercent: number;
  diffImageBuffer: Buffer;
  rawDiffData: Uint8ClampedArray;
  width: number;
  height: number;
}

export async function runPixelDiff(
  baselineBuffer: Buffer,
  capturedBuffer: Buffer,
  options?: { threshold?: number },
): Promise<PixelDiffResult> {
  let [base, curr] = await Promise.all([
    sharp(baselineBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(capturedBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);

  // Normalize to the same dimensions by extending the smaller image
  if (base.info.width !== curr.info.width || base.info.height !== curr.info.height) {
    const width = Math.max(base.info.width, curr.info.width);
    const height = Math.max(base.info.height, curr.info.height);

    const extend = (img: typeof base, w: number, h: number) =>
      sharp(img.data, { raw: { width: img.info.width, height: img.info.height, channels: 4 } })
        .extend({
          right: w - img.info.width,
          bottom: h - img.info.height,
          background: { r: 255, g: 0, b: 255, alpha: 255 }, // magenta for diff visibility
        })
        .raw()
        .toBuffer({ resolveWithObject: true });

    [base, curr] = await Promise.all([
      base.info.width < width || base.info.height < height ? extend(base, width, height) : base,
      curr.info.width < width || curr.info.height < height ? extend(curr, width, height) : curr,
    ]);
  }

  const { width, height } = base.info;

  const diffData = new Uint8ClampedArray(width * height * 4);

  const diffPixelCount = pixelmatch(
    new Uint8ClampedArray(base.data),
    new Uint8ClampedArray(curr.data),
    diffData,
    width,
    height,
    { threshold: options?.threshold ?? 0.1, includeAA: false },
  );

  const diffPercent = (diffPixelCount / (width * height)) * 100;

  const diffImageBuffer = await sharp(Buffer.from(diffData), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  return {
    diffPixelCount,
    diffPercent,
    diffImageBuffer,
    rawDiffData: diffData,
    width,
    height,
  };
}
