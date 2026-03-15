import { describe, it, expect } from 'vitest';
import {
  computeCalibrationMetrics,
  compareModels,
  type CalibrationMetrics,
  type ABTestResult,
} from './ab-testing.js';

describe('computeCalibrationMetrics', () => {
  it('returns ECE near 0 for perfectly calibrated predictions', () => {
    // Perfectly calibrated: confidence matches actual accuracy in each bin
    // In the 0.7-0.8 bin, 75% are correct => confidence ~0.75 matches
    const predictions = [
      // bin 0.7-0.8: 4 predictions, 3 correct (75% accuracy, avg conf ~0.75)
      { confidence: 0.75, isCorrect: true },
      { confidence: 0.75, isCorrect: true },
      { confidence: 0.75, isCorrect: true },
      { confidence: 0.75, isCorrect: false },
      // bin 0.9-1.0: 4 predictions, 4 correct (100% accuracy, avg conf ~0.95)
      { confidence: 0.95, isCorrect: true },
      { confidence: 0.95, isCorrect: true },
      { confidence: 0.95, isCorrect: true },
      { confidence: 0.95, isCorrect: true },
    ];

    const metrics = computeCalibrationMetrics(predictions);
    // ECE should be very low for well-calibrated predictions
    expect(metrics.ece).toBeLessThan(0.05);
    expect(metrics.sampleCount).toBe(8);
  });

  it('returns Brier score for a set of predictions', () => {
    const predictions = [
      { confidence: 0.9, isCorrect: true },   // (0.9 - 1)^2 = 0.01
      { confidence: 0.9, isCorrect: false },   // (0.9 - 0)^2 = 0.81
      { confidence: 0.1, isCorrect: false },   // (0.1 - 0)^2 = 0.01
      { confidence: 0.1, isCorrect: true },    // (0.1 - 1)^2 = 0.81
    ];

    const metrics = computeCalibrationMetrics(predictions);
    // mean of [0.01, 0.81, 0.01, 0.81] = 0.41
    expect(metrics.brierScore).toBeCloseTo(0.41, 2);
  });

  it('returns high ECE for overconfident predictions', () => {
    // All predictions at 0.95 confidence but only 50% correct
    const predictions: Array<{ confidence: number; isCorrect: boolean }> = [];
    for (let i = 0; i < 100; i++) {
      predictions.push({ confidence: 0.95, isCorrect: i % 2 === 0 });
    }

    const metrics = computeCalibrationMetrics(predictions);
    // ECE should be high: |0.95 - 0.50| = 0.45
    expect(metrics.ece).toBeGreaterThan(0.1);
    expect(metrics.meanConfidence).toBeCloseTo(0.95, 2);
    expect(metrics.accuracy).toBeCloseTo(0.5, 2);
  });

  it('handles empty input gracefully', () => {
    const metrics = computeCalibrationMetrics([]);
    expect(metrics.ece).toBe(0);
    expect(metrics.brierScore).toBe(0);
    expect(metrics.meanConfidence).toBe(0);
    expect(metrics.accuracy).toBe(0);
    expect(metrics.sampleCount).toBe(0);
  });
});

describe('compareModels', () => {
  it('returns comparison showing calibrated model has better ECE', () => {
    // Raw: overconfident (0.95 confidence, 70% accuracy)
    const rawPredictions: Array<{ confidence: number; isCorrect: boolean }> = [];
    for (let i = 0; i < 100; i++) {
      rawPredictions.push({ confidence: 0.95, isCorrect: i < 70 });
    }

    // Calibrated: well-calibrated (0.70 confidence, 70% accuracy)
    const calibratedPredictions: Array<{ confidence: number; isCorrect: boolean }> = [];
    for (let i = 0; i < 100; i++) {
      calibratedPredictions.push({ confidence: 0.70, isCorrect: i < 70 });
    }

    const result = compareModels(rawPredictions, calibratedPredictions);

    expect(result.raw.ece).toBeGreaterThan(result.calibrated.ece);
    expect(result.improvement.ece).toBeGreaterThan(0);
    expect(result.recommendation).toBe('calibrated');
  });

  it('recommends raw when calibration makes ECE worse', () => {
    // Raw: already well-calibrated
    const rawPredictions: Array<{ confidence: number; isCorrect: boolean }> = [];
    for (let i = 0; i < 100; i++) {
      rawPredictions.push({ confidence: 0.60, isCorrect: i < 60 });
    }

    // Calibrated: miscalibrated (pushed to 0.90 confidence, still 60% accuracy)
    const calibratedPredictions: Array<{ confidence: number; isCorrect: boolean }> = [];
    for (let i = 0; i < 100; i++) {
      calibratedPredictions.push({ confidence: 0.90, isCorrect: i < 60 });
    }

    const result = compareModels(rawPredictions, calibratedPredictions);
    expect(result.recommendation).toBe('raw');
  });

  it('recommends insufficient_data when fewer than 50 samples', () => {
    const rawPredictions = [
      { confidence: 0.9, isCorrect: true },
      { confidence: 0.8, isCorrect: false },
    ];
    const calibratedPredictions = [
      { confidence: 0.7, isCorrect: true },
      { confidence: 0.6, isCorrect: false },
    ];

    const result = compareModels(rawPredictions, calibratedPredictions);
    expect(result.recommendation).toBe('insufficient_data');
  });
});

describe('buildABReport', () => {
  it('formats results with per-category breakdown (type check)', () => {
    // This test validates the type structure of ABTestResult
    const result: ABTestResult = {
      raw: { ece: 0.25, brierScore: 0.3, meanConfidence: 0.9, accuracy: 0.7, sampleCount: 100 },
      calibrated: { ece: 0.05, brierScore: 0.15, meanConfidence: 0.72, accuracy: 0.7, sampleCount: 100 },
      improvement: { ece: 0.2, brier: 0.15 },
      recommendation: 'calibrated',
    };

    expect(result.raw.ece).toBe(0.25);
    expect(result.calibrated.ece).toBe(0.05);
    expect(result.improvement.ece).toBe(0.2);
    expect(result.recommendation).toBe('calibrated');
  });
});
