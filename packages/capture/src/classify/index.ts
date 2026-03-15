export { classifyDiff, type ClassifyDiffResult, type ClassifyDiffRegion } from './classify-diff.js';
export { classifySingleRegion, type ChangeCategory, type Classification } from './heuristic-classifier.js';
export { type Region } from './connected-components.js';
export { classifyWithOnnx, getModelVersion, buildFeatureVector } from './onnx-classifier.js';
export { deriveSpatialZone, type SpatialZone } from './region-features.js';
export { computeCalibrationMetrics, compareModels, buildABReport, type CalibrationMetrics, type ABTestResult } from './ab-testing.js';
