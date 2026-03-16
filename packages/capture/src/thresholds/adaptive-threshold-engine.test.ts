import { describe, it, expect } from 'vitest';
import {
  hasEnoughHistory,
  computeAdaptiveThresholds,
  type ThresholdHistoryEntry,
} from './adaptive-threshold-engine';

describe('hasEnoughHistory', () => {
  it('returns false when fewer entries than minRuns', () => {
    const history: ThresholdHistoryEntry[] = [
      { pixelDiffPercent: 0.02, ssimScore: 0.999 },
      { pixelDiffPercent: 0.03, ssimScore: 0.998 },
    ];
    expect(hasEnoughHistory(history, 5)).toBe(false);
  });

  it('returns true when enough entries', () => {
    const history: ThresholdHistoryEntry[] = Array.from({ length: 10 }, (_, i) => ({
      pixelDiffPercent: 0.02 + i * 0.001,
      ssimScore: 0.999 - i * 0.0001,
    }));
    expect(hasEnoughHistory(history, 10)).toBe(true);
    expect(hasEnoughHistory(history, 5)).toBe(true);
  });
});

describe('computeAdaptiveThresholds', () => {
  it('produces tight thresholds for stable routes with low consistent diffs', () => {
    // Deterministic stable data: diffs between 0.02 and 0.05
    const history: ThresholdHistoryEntry[] = Array.from({ length: 20 }, (_, i) => ({
      pixelDiffPercent: 0.02 + (i / 20) * 0.03,
      ssimScore: 0.998 + (i / 20) * 0.001,
    }));
    const result = computeAdaptiveThresholds(history);
    expect(result.pixelDiffPercent).toBeLessThan(1);
    expect(result.ssimMin).toBeGreaterThan(0.99);
  });

  it('produces wide thresholds for variable routes', () => {
    // Wide range: 0 to 9.5% pixel diff, low SSIM around 0.90-0.94
    const history: ThresholdHistoryEntry[] = Array.from({ length: 20 }, (_, i) => ({
      pixelDiffPercent: i * 0.5,
      ssimScore: 0.90 + (i / 20) * 0.04,
    }));
    const result = computeAdaptiveThresholds(history);
    expect(result.pixelDiffPercent).toBeGreaterThan(5);
    expect(result.ssimMin).toBeLessThan(0.95);
  });

  it('returns non-zero pixel threshold and ssim < 1 for all-zero history', () => {
    const history: ThresholdHistoryEntry[] = Array.from({ length: 20 }, () => ({
      pixelDiffPercent: 0,
      ssimScore: 1,
    }));
    const result = computeAdaptiveThresholds(history);
    expect(result.pixelDiffPercent).toBeGreaterThan(0);
    expect(result.ssimMin).toBeLessThan(1);
  });

  it('handles null ssimScore entries gracefully', () => {
    const history: ThresholdHistoryEntry[] = Array.from({ length: 20 }, () => ({
      pixelDiffPercent: 0.05,
      ssimScore: null,
    }));
    const result = computeAdaptiveThresholds(history);
    expect(result.pixelDiffPercent).toBeGreaterThan(0);
    expect(result.ssimMin).toBe(0.95);
  });
});
