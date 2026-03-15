import sharp from 'sharp';
import { ssim } from 'ssim.js';

export interface SsimDiffResult {
  mssim: number | null;
  skipped: boolean;
}

export async function runSsimDiff(
  baselineBuffer: Buffer,
  capturedBuffer: Buffer,
): Promise<SsimDiffResult> {
  let [base, curr] = await Promise.all([
    sharp(baselineBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(capturedBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);

  // Normalize to the same dimensions by extending the smaller image
  if (base.info.width !== curr.info.width || base.info.height !== curr.info.height) {
    const w = Math.max(base.info.width, curr.info.width);
    const h = Math.max(base.info.height, curr.info.height);

    const extend = (img: typeof base, tw: number, th: number) =>
      sharp(img.data, { raw: { width: img.info.width, height: img.info.height, channels: 4 } })
        .extend({
          right: tw - img.info.width,
          bottom: th - img.info.height,
          background: { r: 255, g: 0, b: 255, alpha: 255 },
        })
        .raw()
        .toBuffer({ resolveWithObject: true });

    [base, curr] = await Promise.all([
      base.info.width < w || base.info.height < h ? extend(base, w, h) : base,
      curr.info.width < w || curr.info.height < h ? extend(curr, w, h) : curr,
    ]);
  }

  const { width, height } = base.info;

  if (width < 11 || height < 11) {
    return { mssim: null, skipped: true };
  }

  const img1 = {
    data: new Uint8ClampedArray(base.data),
    width,
    height,
  };

  const img2 = {
    data: new Uint8ClampedArray(curr.data),
    width,
    height,
  };

  const { mssim: mssimScore } = ssim(img1, img2);

  return { mssim: mssimScore, skipped: false };
}
