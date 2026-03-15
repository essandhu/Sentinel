import * as ort from 'onnxruntime-node';
import type { Region } from './connected-components.js';
import { extractFeatures } from './region-features.js';
import type { ChangeCategory, Classification } from './heuristic-classifier.js';

const CATEGORIES: ChangeCategory[] = ['layout', 'style', 'content', 'cosmetic'];

let session: ort.InferenceSession | null = null;
let sessionFailed = false;
let modelVersion: string | null = null;

const MODEL_PATH = process.env.ONNX_MODEL_PATH ?? './models/diff-classifier.onnx';

/**
 * Get or create the ONNX InferenceSession singleton.
 * Returns null if the model file is missing or session creation fails.
 */
export async function getSession(): Promise<ort.InferenceSession | null> {
  if (sessionFailed) return null;
  if (session) return session;

  try {
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ['cpu'],
    });
    modelVersion = process.env.ONNX_MODEL_VERSION ?? 'unknown';
    return session;
  } catch {
    sessionFailed = true;
    return null;
  }
}

/**
 * Returns the model version string if ONNX has been loaded, null otherwise.
 */
export function getModelVersion(): string | null {
  return modelVersion;
}

/**
 * Build a fixed-size feature vector (11 elements) from detected change regions.
 * This vector matches the ONNX model's expected input shape.
 *
 * Features: [regionCount, changeCoverage, maxDensity, avgAspectRatio, edgeAlignedRatio,
 *  maxVerticalSpan, maxHorizontalSpan, avgRelativeWidth, avgRelativeHeight,
 *  largeRegionCount, denseRectCount]
 */
export function buildFeatureVector(
  regions: Region[],
  imageWidth: number,
  imageHeight: number,
): Float32Array {
  const totalPixels = imageWidth * imageHeight;
  const totalChanged = regions.reduce((s, r) => s + r.pixelCount, 0);
  const features = regions.map((r) => extractFeatures(r, imageWidth, imageHeight));

  const vec = new Float32Array(11);
  vec[0] = regions.length;
  vec[1] = totalPixels > 0 ? totalChanged / totalPixels : 0;

  if (features.length === 0) {
    // All remaining values are already 0 from Float32Array initialization
    return vec;
  }

  vec[2] = Math.max(...features.map((f) => f.density));
  vec[3] = features.reduce((s, f) => s + f.aspectRatio, 0) / features.length;
  vec[4] = features.filter((f) => f.isEdgeAligned).length / features.length;
  vec[5] = Math.max(...features.map((f) => f.verticalSpan));
  vec[6] = Math.max(...features.map((f) => f.horizontalSpan));
  vec[7] = features.reduce((s, f) => s + f.relativeWidth, 0) / features.length;
  vec[8] = features.reduce((s, f) => s + f.relativeHeight, 0) / features.length;
  vec[9] = regions.filter(
    (r) => (r.boundingBox.width * r.boundingBox.height) / totalPixels > 0.05,
  ).length;
  vec[10] = regions.filter((r) => {
    const area = r.boundingBox.width * r.boundingBox.height;
    return (
      r.pixelCount / area > 0.6 &&
      area / totalPixels > 0.01 &&
      area / totalPixels < 0.15
    );
  }).length;

  return vec;
}

/**
 * Build a feature vector for a single region, setting regionCount=1.
 * Used for per-region ONNX inference (experimental -- see research notes).
 */
export function buildSingleRegionFeatureVector(
  region: Region,
  imageWidth: number,
  imageHeight: number,
): Float32Array {
  return buildFeatureVector([region], imageWidth, imageHeight);
}

/**
 * Classify a single region using the ONNX model.
 * Returns the category and confidence for the region, or null if the model is unavailable.
 *
 * Note: The current model is trained on aggregate features. Per-region inference
 * with regionCount=1 may produce lower-quality results. This is experimental.
 */
export async function classifyRegionWithOnnx(
  region: Region,
  imageWidth: number,
  imageHeight: number,
): Promise<{ category: ChangeCategory; confidence: number } | null> {
  const sess = await getSession();
  if (!sess) return null;

  const featureVec = buildSingleRegionFeatureVector(region, imageWidth, imageHeight);
  const tensor = new ort.Tensor('float32', featureVec, [1, 11]);
  const results = await sess.run({ input: tensor });
  const outputData = results['output'].data as Float32Array;

  let maxIdx = 0;
  let maxProb = outputData[0];
  for (let i = 1; i < outputData.length; i++) {
    if (outputData[i] > maxProb) {
      maxProb = outputData[i];
      maxIdx = i;
    }
  }

  return {
    category: CATEGORIES[maxIdx],
    confidence: maxProb,
  };
}

/**
 * Classify regions using the ONNX model.
 * Returns null if the model is unavailable (triggering heuristic fallback).
 */
export async function classifyWithOnnx(
  regions: Region[],
  imageWidth: number,
  imageHeight: number,
): Promise<{ classification: Classification; modelVersion: string } | null> {
  const sess = await getSession();
  if (!sess) return null;

  const featureVec = buildFeatureVector(regions, imageWidth, imageHeight);
  const tensor = new ort.Tensor('float32', featureVec, [1, 11]);
  const results = await sess.run({ input: tensor });
  const outputData = results['output'].data as Float32Array;

  // Find the category with the highest probability
  let maxIdx = 0;
  let maxProb = outputData[0];
  for (let i = 1; i < outputData.length; i++) {
    if (outputData[i] > maxProb) {
      maxProb = outputData[i];
      maxIdx = i;
    }
  }

  const category = CATEGORIES[maxIdx];
  const ver = modelVersion ?? 'unknown';

  const classification: Classification = {
    category,
    confidence: maxProb,
    reasons: [`ML model classification (v${ver})`],
    regions,
  };

  return { classification, modelVersion: ver };
}

/**
 * Reset session state (for testing only).
 */
export function resetSession(): void {
  session = null;
  sessionFailed = false;
  modelVersion = null;
}

// Clean up native ONNX resources on process exit
process.on('exit', () => {
  session?.release();
});
