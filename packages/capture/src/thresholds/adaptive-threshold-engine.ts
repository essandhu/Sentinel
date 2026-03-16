export interface ThresholdHistoryEntry {
  pixelDiffPercent: number;
  ssimScore: number | null;
}

export interface AdaptiveThresholdResult {
  pixelDiffPercent: number;
  ssimMin: number;
}

export const hasEnoughHistory = (
  history: ThresholdHistoryEntry[],
  minRuns: number,
): boolean => history.length >= minRuns;

const percentile = (sorted: number[], p: number): number => {
  const idx = Math.min(Math.max(Math.ceil(sorted.length * p) - 1, 0), sorted.length - 1);
  return sorted[idx];
};

export const computeAdaptiveThresholds = (
  history: ThresholdHistoryEntry[],
  p = 0.95,
): AdaptiveThresholdResult => {
  const pixelValues = history.map((h) => h.pixelDiffPercent).sort((a, b) => a - b);
  const p95Pixel = percentile(pixelValues, p);
  const pixelDiffPercent = Math.max(p95Pixel * 1.2, 0.01);

  const ssimValues = history
    .map((h) => h.ssimScore)
    .filter((s): s is number => s !== null)
    .sort((a, b) => a - b);

  let ssimMin: number;
  if (ssimValues.length === 0) {
    ssimMin = 0.95;
  } else {
    const p5Ssim = percentile(ssimValues, 1 - p);
    ssimMin = Math.min(p5Ssim * 0.998, 1 - 0.001);
  }

  return { pixelDiffPercent, ssimMin };
};
