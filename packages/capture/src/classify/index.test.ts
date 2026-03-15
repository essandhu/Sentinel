import { describe, it, expect } from 'vitest';
import * as classifyIndex from './index.js';

describe('classify/index re-exports', () => {
  it('exports classifyDiff function', () => {
    expect(typeof classifyIndex.classifyDiff).toBe('function');
  });

  it('exports classifySingleRegion function', () => {
    expect(typeof classifyIndex.classifySingleRegion).toBe('function');
  });

  it('exports classifyWithOnnx function', () => {
    expect(typeof classifyIndex.classifyWithOnnx).toBe('function');
  });

  it('exports getModelVersion function', () => {
    expect(typeof classifyIndex.getModelVersion).toBe('function');
  });

  it('exports buildFeatureVector function', () => {
    expect(typeof classifyIndex.buildFeatureVector).toBe('function');
  });

  it('exports deriveSpatialZone function', () => {
    expect(typeof classifyIndex.deriveSpatialZone).toBe('function');
  });

  it('exports computeCalibrationMetrics function', () => {
    expect(typeof classifyIndex.computeCalibrationMetrics).toBe('function');
  });

  it('exports compareModels function', () => {
    expect(typeof classifyIndex.compareModels).toBe('function');
  });

  it('exports buildABReport function', () => {
    expect(typeof classifyIndex.buildABReport).toBe('function');
  });
});
