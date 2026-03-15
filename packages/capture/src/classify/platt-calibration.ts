import { readFile, writeFile } from 'node:fs/promises';

export interface PlattParams {
  A: number;
  B: number;
}

/**
 * Apply Platt scaling to transform a raw confidence score into a calibrated probability.
 *
 * Uses the sigmoid: P(y=1|f) = 1 / (1 + exp(A*f + B))
 *
 * @param rawConfidence - Raw model output (0-1)
 * @param params - Fitted Platt parameters
 * @returns Calibrated probability (0-1)
 */
export function applyPlattScaling(rawConfidence: number, params: PlattParams): number {
  return 1 / (1 + Math.exp(params.A * rawConfidence + params.B));
}

/**
 * Fit Platt scaling parameters using Newton-Raphson optimization.
 *
 * Port of sklearn's _sigmoid_calibration: finds A, B that minimize
 * the negative log-likelihood of the sigmoid model on calibration data.
 *
 * @param data - Array of { rawScore, isCorrect } calibration samples
 * @param minSamples - Minimum samples required (default 200)
 * @returns Fitted PlattParams, or null if insufficient data
 */
export function fitPlattParams(
  data: Array<{ rawScore: number; isCorrect: boolean }>,
  minSamples = 200,
): PlattParams | null {
  if (data.length < minSamples) {
    return null;
  }

  const n = data.length;

  // Target probabilities with Bayesian correction (per Platt's original paper)
  const nPositive = countPositive(data);
  const nNegative = n - nPositive;
  const hiTarget = (nPositive + 1) / (nPositive + 2);
  const loTarget = 1 / (nNegative + 2);

  const targets = data.map((d) => (d.isCorrect ? hiTarget : loTarget));
  const scores = data.map((d) => d.rawScore);

  let A = 0;
  let B = Math.log((nNegative + 1) / (nPositive + 1));

  const maxIter = 100;
  const eps = 1e-12;
  let prevLogLik = -Infinity;

  for (let iter = 0; iter < maxIter; iter++) {
    // Compute predictions, gradient, and Hessian
    let d1a = 0; // dA
    let d1b = 0; // dB
    let d2a = 0; // d2A
    let d2b = 0; // d2B
    let d2ab = 0;
    let logLik = 0;

    for (let i = 0; i < n; i++) {
      const fApB = A * scores[i] + B;
      let p: number;

      // Numerically stable sigmoid computation
      if (fApB >= 0) {
        const expNeg = Math.exp(-fApB);
        p = 1 / (1 + expNeg);
        logLik += targets[i] * (-fApB) + Math.log(1 + expNeg);
      } else {
        const expPos = Math.exp(fApB);
        p = expPos / (1 + expPos);
        logLik += (targets[i] - 1) * fApB + Math.log(1 + expPos);
      }

      const d = targets[i] - p;
      const q = p * (1 - p);

      d1a += scores[i] * d;
      d1b += d;
      d2a += scores[i] * scores[i] * q;
      d2b += q;
      d2ab += scores[i] * q;
    }

    // Check convergence
    if (Math.abs(logLik - prevLogLik) < eps) {
      break;
    }
    prevLogLik = logLik;

    // Newton-Raphson update with regularization
    const det = d2a * d2b - d2ab * d2ab;
    if (Math.abs(det) < 1e-20) {
      break; // Hessian is singular
    }

    const dA = -(d2b * d1a - d2ab * d1b) / det;
    const dB = -(d2a * d1b - d2ab * d1a) / det;

    // Line search with step halving
    let stepSize = 1;
    for (let step = 0; step < 10; step++) {
      const newA = A + stepSize * dA;
      const newB = B + stepSize * dB;

      // Evaluate new log-likelihood
      let newLogLik = 0;
      for (let i = 0; i < n; i++) {
        const fApB = newA * scores[i] + newB;
        if (fApB >= 0) {
          newLogLik += targets[i] * (-fApB) + Math.log(1 + Math.exp(-fApB));
        } else {
          newLogLik += (targets[i] - 1) * fApB + Math.log(1 + Math.exp(fApB));
        }
      }

      if (newLogLik < logLik + 1e-4 * stepSize * (d1a * dA + d1b * dB)) {
        A = newA;
        B = newB;
        break;
      }
      stepSize /= 2;
    }
  }

  return { A, B };
}

function countPositive(data: Array<{ rawScore: number; isCorrect: boolean }>): number {
  return data.filter((d) => d.isCorrect).length;
}

/**
 * Load Platt parameters from a JSON file.
 *
 * @param filePath - Path to the platt-params.json file
 * @returns Parsed PlattParams or null if file missing/invalid
 */
export async function loadPlattParams(filePath: string): Promise<PlattParams | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content) as PlattParams;
    if (typeof parsed.A === 'number' && typeof parsed.B === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save Platt parameters to a JSON file.
 *
 * @param params - PlattParams to persist
 * @param filePath - Destination file path
 */
export async function savePlattParams(params: PlattParams, filePath: string): Promise<void> {
  await writeFile(filePath, JSON.stringify(params, null, 2), 'utf-8');
}
