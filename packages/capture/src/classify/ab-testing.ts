import { eq, and, isNotNull } from 'drizzle-orm';
import { diffClassifications, classificationOverrides } from '@sentinel-vrt/db';
import type { Db } from '@sentinel-vrt/db';

/**
 * Calibration metrics for a set of predictions.
 */
export interface CalibrationMetrics {
  /** Expected Calibration Error (lower is better) */
  ece: number;
  /** Brier score (lower is better) */
  brierScore: number;
  /** Mean predicted confidence */
  meanConfidence: number;
  /** Fraction of correct predictions */
  accuracy: number;
  /** Number of samples */
  sampleCount: number;
}

/**
 * Result of comparing raw vs calibrated model predictions.
 */
export interface ABTestResult {
  raw: CalibrationMetrics;
  calibrated: CalibrationMetrics;
  /** Positive values mean calibrated is better */
  improvement: { ece: number; brier: number };
  recommendation: 'raw' | 'calibrated' | 'insufficient_data';
}

/**
 * Compute calibration metrics (ECE and Brier score) from a set of predictions.
 *
 * ECE divides predictions into equal-width confidence bins and measures
 * the weighted average gap between predicted confidence and actual accuracy.
 *
 * Brier score is the mean squared error between confidence and actual outcome.
 *
 * @param predictions - Array of { confidence: [0,1], isCorrect: boolean }
 * @param bins - Number of equal-width bins for ECE (default 10)
 */
export function computeCalibrationMetrics(
  predictions: Array<{ confidence: number; isCorrect: boolean }>,
  bins = 10,
): CalibrationMetrics {
  const n = predictions.length;

  if (n === 0) {
    return { ece: 0, brierScore: 0, meanConfidence: 0, accuracy: 0, sampleCount: 0 };
  }

  // Brier score: mean of (confidence - actual)^2
  let brierSum = 0;
  let confSum = 0;
  let correctCount = 0;

  for (const p of predictions) {
    const actual = p.isCorrect ? 1 : 0;
    brierSum += (p.confidence - actual) ** 2;
    confSum += p.confidence;
    if (p.isCorrect) correctCount++;
  }

  const brierScore = brierSum / n;
  const meanConfidence = confSum / n;
  const accuracy = correctCount / n;

  // ECE: divide into equal-width confidence bins
  // Bins: [0, 1/bins), [1/bins, 2/bins), ..., [(bins-1)/bins, 1]
  const binCounts = new Float64Array(bins);
  const binConfSums = new Float64Array(bins);
  const binCorrectSums = new Float64Array(bins);

  for (const p of predictions) {
    let binIdx = Math.floor(p.confidence * bins);
    // Handle confidence === 1.0 edge case
    if (binIdx >= bins) binIdx = bins - 1;

    binCounts[binIdx]++;
    binConfSums[binIdx] += p.confidence;
    binCorrectSums[binIdx] += p.isCorrect ? 1 : 0;
  }

  let ece = 0;
  for (let i = 0; i < bins; i++) {
    if (binCounts[i] === 0) continue;
    const avgConf = binConfSums[i] / binCounts[i];
    const avgAcc = binCorrectSums[i] / binCounts[i];
    ece += (binCounts[i] / n) * Math.abs(avgConf - avgAcc);
  }

  return { ece, brierScore, meanConfidence, accuracy, sampleCount: n };
}

/**
 * Compare raw vs calibrated model predictions.
 *
 * @param rawPredictions - Predictions using raw (uncalibrated) confidence
 * @param calibratedPredictions - Predictions using calibrated confidence
 * @returns ABTestResult with recommendation
 */
export function compareModels(
  rawPredictions: Array<{ confidence: number; isCorrect: boolean }>,
  calibratedPredictions: Array<{ confidence: number; isCorrect: boolean }>,
): ABTestResult {
  const raw = computeCalibrationMetrics(rawPredictions);
  const calibrated = computeCalibrationMetrics(calibratedPredictions);

  const eceImprovement = raw.ece - calibrated.ece; // positive = calibrated better
  const brierImprovement = raw.brierScore - calibrated.brierScore;

  const totalSamples = Math.max(raw.sampleCount, calibrated.sampleCount);

  let recommendation: 'raw' | 'calibrated' | 'insufficient_data';
  if (totalSamples < 50) {
    recommendation = 'insufficient_data';
  } else if (eceImprovement > 0.01) {
    recommendation = 'calibrated';
  } else if (eceImprovement < -0.01) {
    recommendation = 'raw';
  } else {
    // Within noise threshold -- prefer calibrated if brier is also better
    recommendation = brierImprovement > 0 ? 'calibrated' : 'raw';
  }

  return {
    raw,
    calibrated,
    improvement: { ece: eceImprovement, brier: brierImprovement },
    recommendation,
  };
}

/**
 * Build an A/B comparison report from stored classification data.
 *
 * Queries diffClassifications where both confidence (calibrated) and rawConfidence
 * exist, joining with classificationOverrides to determine correctness.
 *
 * @param db - Drizzle database instance
 * @returns ABTestResult or null if insufficient data
 */
export async function buildABReport(db: Db): Promise<ABTestResult | null> {
  // Query classifications that have both raw and calibrated confidence
  const rows = await db
    .select({
      confidence: diffClassifications.confidence,
      rawConfidence: diffClassifications.rawConfidence,
      category: diffClassifications.category,
      diffReportId: diffClassifications.diffReportId,
    })
    .from(diffClassifications)
    .where(
      and(
        isNotNull(diffClassifications.rawConfidence),
        isNotNull(diffClassifications.calibrationVersion),
      ),
    );

  if (rows.length < 10) {
    return null;
  }

  // Get all overrides for these diff reports
  const overrideRows = await db
    .select({
      diffReportId: classificationOverrides.diffReportId,
      originalCategory: classificationOverrides.originalCategory,
      overrideCategory: classificationOverrides.overrideCategory,
    })
    .from(classificationOverrides);

  // Index overrides by diffReportId
  const overrideMap = new Map<string, { originalCategory: string; overrideCategory: string }>();
  for (const o of overrideRows) {
    overrideMap.set(o.diffReportId, o);
  }

  // Build prediction arrays
  const rawPredictions: Array<{ confidence: number; isCorrect: boolean }> = [];
  const calibratedPredictions: Array<{ confidence: number; isCorrect: boolean }> = [];

  for (const row of rows) {
    if (row.rawConfidence == null) continue;

    const override = overrideMap.get(row.diffReportId);
    // isCorrect: no override means original classification was accepted
    const isCorrect = override == null || override.overrideCategory === row.category;

    rawPredictions.push({
      confidence: row.rawConfidence / 100,
      isCorrect,
    });

    calibratedPredictions.push({
      confidence: row.confidence / 100,
      isCorrect,
    });
  }

  if (rawPredictions.length < 10) {
    return null;
  }

  return compareModels(rawPredictions, calibratedPredictions);
}
