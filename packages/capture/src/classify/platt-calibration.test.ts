import { describe, it, expect, vi } from 'vitest';
import {
  applyPlattScaling,
  fitPlattParams,
  loadPlattParams,
  type PlattParams,
} from './platt-calibration.js';

describe('applyPlattScaling', () => {
  it('returns 0.5 when A=0 and B=0 (identity case)', () => {
    const result = applyPlattScaling(0.7, { A: 0, B: 0 });
    expect(result).toBeCloseTo(0.5, 5);
  });

  it('compresses overconfident scores toward 0.5 with negative A', () => {
    const params: PlattParams = { A: -2, B: 0 };
    // With negative A and raw=0.9: sigmoid(1/(1+exp(-2*0.9+0))) = 1/(1+exp(-1.8))
    // exp(-1.8) ~ 0.1653, so result ~ 1/1.1653 ~ 0.858
    // Should be less than 0.9 (compressed toward 0.5)
    const result = applyPlattScaling(0.9, params);
    expect(result).toBeLessThan(0.9);
    expect(result).toBeGreaterThan(0.5);
  });

  it('applies the Platt sigmoid formula correctly', () => {
    // 1 / (1 + exp(A*f + B))
    // A = -1, B = 0.5, f = 0.8
    // exp(-1*0.8 + 0.5) = exp(-0.3) ~ 0.7408
    // 1 / (1 + 0.7408) ~ 0.5744
    const result = applyPlattScaling(0.8, { A: -1, B: 0.5 });
    expect(result).toBeCloseTo(1 / (1 + Math.exp(-1 * 0.8 + 0.5)), 5);
  });
});

describe('fitPlattParams', () => {
  it('returns null when data has fewer than minSamples', () => {
    const data = [
      { rawScore: 0.9, isCorrect: true },
      { rawScore: 0.1, isCorrect: false },
    ];
    const result = fitPlattParams(data, 200);
    expect(result).toBeNull();
  });

  it('returns null for empty array', () => {
    const result = fitPlattParams([]);
    expect(result).toBeNull();
  });

  it('converges with synthetic calibration data', () => {
    // Generate 500 samples where isCorrect correlates with rawScore
    const data: Array<{ rawScore: number; isCorrect: boolean }> = [];
    // Use a simple seeded pattern for determinism
    for (let i = 0; i < 500; i++) {
      const rawScore = i / 500;
      // Higher raw scores are more likely correct
      const isCorrect = rawScore > 0.5 ? (i % 5 !== 0 ? true : false) : (i % 5 === 0 ? true : false);
      data.push({ rawScore, isCorrect });
    }

    const result = fitPlattParams(data, 200);
    expect(result).not.toBeNull();
    expect(result!.A).toBeTypeOf('number');
    expect(result!.B).toBeTypeOf('number');
    // A should be negative (higher score -> higher probability)
    expect(result!.A).toBeLessThan(0);
    expect(Number.isFinite(result!.A)).toBe(true);
    expect(Number.isFinite(result!.B)).toBe(true);
  });
});

describe('loadPlattParams', () => {
  it('returns null for missing file', async () => {
    const result = await loadPlattParams('/nonexistent/path/platt-params.json');
    expect(result).toBeNull();
  });
});
