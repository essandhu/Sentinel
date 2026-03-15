import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock onnxruntime-node before importing the module under test
const mockRun = vi.fn();
const mockRelease = vi.fn();
const mockCreate = vi.fn();

vi.mock('onnxruntime-node', () => ({
  default: {
    InferenceSession: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    Tensor: class MockTensor {
      type: string;
      data: Float32Array;
      dims: number[];
      constructor(type: string, data: Float32Array, dims: number[]) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      }
    },
  },
  InferenceSession: {
    create: (...args: unknown[]) => mockCreate(...args),
  },
  Tensor: class MockTensor {
    type: string;
    data: Float32Array;
    dims: number[];
    constructor(type: string, data: Float32Array, dims: number[]) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    }
  },
}));

import {
  classifyWithOnnx,
  classifyRegionWithOnnx,
  getModelVersion,
  buildFeatureVector,
  buildSingleRegionFeatureVector,
  resetSession,
} from './onnx-classifier.js';
import type { Region } from './connected-components.js';

function makeRegion(overrides: Partial<Region> & { id: number }): Region {
  return {
    pixels: [],
    boundingBox: { x: 10, y: 10, width: 50, height: 40 },
    pixelCount: 500,
    ...overrides,
  };
}

describe('onnx-classifier', () => {
  beforeEach(() => {
    resetSession();
    mockCreate.mockReset();
    mockRun.mockReset();
    mockRelease.mockReset();
    delete process.env.ONNX_MODEL_VERSION;
  });

  describe('classifyWithOnnx', () => {
    it('returns null when model file does not exist', async () => {
      mockCreate.mockRejectedValueOnce(new Error('ENOENT: no such file'));

      const result = await classifyWithOnnx(
        [makeRegion({ id: 1 })],
        800,
        600,
      );
      expect(result).toBeNull();
    });

    it('returns Classification with category and confidence when session succeeds', async () => {
      // Probabilities: layout=0.1, style=0.2, content=0.3, cosmetic=0.4
      mockCreate.mockResolvedValueOnce({
        run: mockRun.mockResolvedValueOnce({
          output: { data: new Float32Array([0.1, 0.2, 0.3, 0.4]) },
        }),
        inputNames: ['input'],
        release: mockRelease,
      });

      const regions = [makeRegion({ id: 1 })];
      const result = await classifyWithOnnx(regions, 800, 600);

      expect(result).not.toBeNull();
      expect(result!.classification.category).toBe('cosmetic');
      expect(result!.classification.confidence).toBeCloseTo(0.4);
      expect(result!.classification.regions).toBe(regions);
      expect(result!.modelVersion).toBe('unknown');
    });
  });

  describe('buildFeatureVector', () => {
    it('produces Float32Array of length 11 from regions', () => {
      const regions: Region[] = [
        makeRegion({
          id: 1,
          pixelCount: 1000,
          boundingBox: { x: 0, y: 0, width: 100, height: 50 },
        }),
        makeRegion({
          id: 2,
          pixelCount: 200,
          boundingBox: { x: 200, y: 100, width: 30, height: 20 },
        }),
      ];

      const vec = buildFeatureVector(regions, 800, 600);
      expect(vec).toBeInstanceOf(Float32Array);
      expect(vec.length).toBe(11);
      expect(vec[0]).toBe(2);
      expect(vec[1]).toBeCloseTo(1200 / 480000);
    });

    it('handles empty regions array without NaN', () => {
      const vec = buildFeatureVector([], 800, 600);
      expect(vec).toBeInstanceOf(Float32Array);
      expect(vec.length).toBe(11);
      for (let i = 0; i < vec.length; i++) {
        expect(Number.isFinite(vec[i])).toBe(true);
      }
    });
  });

  describe('buildSingleRegionFeatureVector', () => {
    it('produces Float32Array of length 11 with regionCount=1', () => {
      const region = makeRegion({
        id: 1,
        pixelCount: 500,
        boundingBox: { x: 10, y: 10, width: 50, height: 40 },
      });

      const vec = buildSingleRegionFeatureVector(region, 800, 600);
      expect(vec).toBeInstanceOf(Float32Array);
      expect(vec.length).toBe(11);
      expect(vec[0]).toBe(1); // regionCount always 1
    });

    it('computes coverage from single region pixels', () => {
      const region = makeRegion({
        id: 1,
        pixelCount: 4800,
        boundingBox: { x: 0, y: 0, width: 80, height: 60 },
      });

      const vec = buildSingleRegionFeatureVector(region, 800, 600);
      // changeCoverage = 4800 / (800*600) = 0.01
      expect(vec[1]).toBeCloseTo(0.01);
    });
  });

  describe('classifyRegionWithOnnx', () => {
    it('returns category and confidence for a single region when session available', async () => {
      mockCreate.mockResolvedValueOnce({
        run: mockRun.mockResolvedValueOnce({
          output: { data: new Float32Array([0.1, 0.6, 0.2, 0.1]) },
        }),
        inputNames: ['input'],
        release: mockRelease,
      });

      const region = makeRegion({ id: 1 });
      const result = await classifyRegionWithOnnx(region, 800, 600);

      expect(result).not.toBeNull();
      expect(result!.category).toBe('style');
      expect(result!.confidence).toBeCloseTo(0.6);
    });

    it('returns null when ONNX session unavailable', async () => {
      mockCreate.mockRejectedValueOnce(new Error('ENOENT'));

      const region = makeRegion({ id: 1 });
      const result = await classifyRegionWithOnnx(region, 800, 600);
      expect(result).toBeNull();
    });
  });

  describe('getModelVersion', () => {
    it('returns null before any successful ONNX load', () => {
      expect(getModelVersion()).toBeNull();
    });
  });
});
