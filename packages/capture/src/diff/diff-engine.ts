import { runPixelDiff } from './pixel-diff.js';
import { runSsimDiff } from './ssim-diff.js';

export interface DiffResult {
  pixelDiffPercent: number;
  ssimScore: number | null;
  passed: boolean;
  diffImageBuffer: Buffer;
  rawDiffData: Uint8ClampedArray;
  width: number;
  height: number;
  layers: {
    pixel: { diffPercent: number; diffPixelCount: number };
    ssim?: { score: number };
  };
}

export interface DiffThresholds {
  pixelDiffPercent: number;
  ssimMin: number;
}

export async function runDualDiff(
  baselineBuffer: Buffer,
  capturedBuffer: Buffer,
  thresholds: DiffThresholds,
): Promise<DiffResult> {
  const [pixelResult, ssimResult] = await Promise.all([
    runPixelDiff(baselineBuffer, capturedBuffer),
    runSsimDiff(baselineBuffer, capturedBuffer),
  ]);

  const pixelFailed = pixelResult.diffPercent > thresholds.pixelDiffPercent;

  let passed: boolean;
  let ssimScore: number | null = null;
  const layers: DiffResult['layers'] = {
    pixel: {
      diffPercent: pixelResult.diffPercent,
      diffPixelCount: pixelResult.diffPixelCount,
    },
  };

  if (ssimResult.skipped) {
    // Small image: SSIM skipped, pixel diff is the sole decider
    passed = !pixelFailed;
  } else {
    // Both layers ran: BOTH must fail to report a diff
    const ssimFailed = ssimResult.mssim! < thresholds.ssimMin;
    passed = !(pixelFailed && ssimFailed);
    ssimScore = ssimResult.mssim!;
    layers.ssim = { score: ssimResult.mssim! };
  }

  return {
    pixelDiffPercent: pixelResult.diffPercent,
    ssimScore,
    passed,
    diffImageBuffer: pixelResult.diffImageBuffer,
    rawDiffData: pixelResult.rawDiffData,
    width: pixelResult.width,
    height: pixelResult.height,
    layers,
  };
}
