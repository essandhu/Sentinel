import { findConnectedComponents, type Region } from './connected-components.js';
import { classifyRegions, classifySingleRegion, type Classification } from './heuristic-classifier.js';
import { classifyWithOnnx, classifyRegionWithOnnx } from './onnx-classifier.js';
import { applyPlattScaling, loadPlattParams } from './platt-calibration.js';

export interface ClassifyDiffRegion {
  id: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  pixelCount: number;
  /** Relative X in basis points (0-10000) */
  relX: number;
  /** Relative Y in basis points (0-10000) */
  relY: number;
  /** Relative width in basis points (0-10000) */
  relWidth: number;
  /** Relative height in basis points (0-10000) */
  relHeight: number;
  /** Optional per-region category */
  regionCategory?: string;
  /** Per-region confidence (0-100 integer) */
  regionConfidence?: number;
  /** Spatial zone (header/sidebar/content/footer/full-width) */
  spatialZone?: string;
}

export interface ClassifyDiffResult {
  classification: Classification;
  regions: ClassifyDiffRegion[];
  modelVersion: string | null;
  /** Pre-calibration raw confidence (0-1), present when ONNX was used */
  rawConfidence?: number;
  /** Calibration method version, e.g. 'platt-v1' */
  calibrationVersion?: string | null;
}

// Attempt to load Platt params at module level (lazy, cached)
const plattParamsPromise = loadPlattParams('./models/platt-params.json');

/**
 * Orchestrate the full classification pipeline:
 * 1. Find connected components (change regions) in the diff buffer
 * 2. Try ONNX model classification first, fall back to heuristic
 * 3. For each region, try ONNX per-region inference, fall back to heuristic
 * 4. Apply Platt scaling to aggregate confidence when params available
 *
 * @param diffData - Raw RGBA diff pixel data from pixelmatch
 * @param width - Image width
 * @param height - Image height
 * @returns Classification result with regions and modelVersion, or null if no changes detected
 */
export async function classifyDiff(
  diffData: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<ClassifyDiffResult | null> {
  const components = findConnectedComponents(diffData, width, height);

  if (components.length === 0) {
    return null;
  }

  // Try ONNX first, fall back to heuristic silently
  let classification: Classification;
  let usedModelVersion: string | null = null;
  let usedOnnx = false;

  try {
    const onnxResult = await classifyWithOnnx(components, width, height);
    if (onnxResult) {
      classification = onnxResult.classification;
      usedModelVersion = onnxResult.modelVersion;
      usedOnnx = true;
    } else {
      classification = classifyRegions(components, width, height);
    }
  } catch {
    classification = classifyRegions(components, width, height);
  }

  // Map regions with per-region inference
  const regions: ClassifyDiffRegion[] = await Promise.all(
    components.map(async (region) => {
      // Try ONNX per-region inference first
      let regionCategory: string;
      let regionConfidence: number;
      let spatialZone: string | undefined;

      try {
        const onnxRegion = await classifyRegionWithOnnx(region, width, height);
        if (onnxRegion) {
          regionCategory = onnxRegion.category;
          regionConfidence = Math.round(onnxRegion.confidence * 100);
        } else {
          // Fall back to heuristic
          const single = classifySingleRegion(region, width, height);
          regionCategory = single.category;
          regionConfidence = Math.round(single.confidence * 100);
          spatialZone = single.spatialZone;
        }
      } catch {
        const single = classifySingleRegion(region, width, height);
        regionCategory = single.category;
        regionConfidence = Math.round(single.confidence * 100);
        spatialZone = single.spatialZone;
      }

      // Always compute spatial zone from heuristic if not set
      if (!spatialZone) {
        const single = classifySingleRegion(region, width, height);
        spatialZone = single.spatialZone;
      }

      return {
        id: region.id,
        boundingBox: region.boundingBox,
        pixelCount: region.pixelCount,
        relX: Math.round((region.boundingBox.x / width) * 10000),
        relY: Math.round((region.boundingBox.y / height) * 10000),
        relWidth: Math.round((region.boundingBox.width / width) * 10000),
        relHeight: Math.round((region.boundingBox.height / height) * 10000),
        regionCategory,
        regionConfidence,
        spatialZone,
      };
    }),
  );

  // Apply Platt scaling if ONNX was used and params are available
  let rawConfidence: number | undefined;
  let calibrationVersion: string | null | undefined;

  if (usedOnnx) {
    rawConfidence = classification.confidence;
    const plattParams = await plattParamsPromise;
    if (plattParams) {
      classification = {
        ...classification,
        confidence: applyPlattScaling(rawConfidence, plattParams),
      };
      calibrationVersion = 'platt-v1';
    }
  }

  return {
    classification,
    regions,
    modelVersion: usedModelVersion,
    rawConfidence,
    calibrationVersion,
  };
}
