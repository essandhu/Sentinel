import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock onnxruntime-node to avoid native dependency in tests
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

import { classifyDiff, type ClassifyDiffResult } from './classify-diff.js';
import { resetSession } from './onnx-classifier.js';

/**
 * Helper: create a blank RGBA image buffer (no changes).
 */
function createBlankImage(width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height * 4);
}

/**
 * Helper: paint a solid red rectangle on an RGBA buffer.
 */
function paintRedRect(
  data: Uint8ClampedArray,
  imageWidth: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): void {
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const offset = (y * imageWidth + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 255;
    }
  }
}

describe('classifyDiff', () => {
  beforeEach(() => {
    resetSession();
    mockCreate.mockReset();
    mockRun.mockReset();
    mockRelease.mockReset();
    // Default: ONNX model not available (heuristic fallback)
    mockCreate.mockRejectedValue(new Error('ENOENT'));
  });

  it('returns null on identical images (no diff pixels)', async () => {
    const data = createBlankImage(200, 200);
    const result = await classifyDiff(data, 200, 200);
    expect(result).toBeNull();
  });

  it('returns classification with regions for a diff buffer with a large red region', async () => {
    const width = 400;
    const height = 300;
    const data = createBlankImage(width, height);
    paintRedRect(data, width, 50, 50, 100, 80);

    const result = await classifyDiff(data, width, height);
    expect(result).not.toBeNull();
    expect(result!.classification).toBeDefined();
    expect(result!.classification.category).toBeTruthy();
    expect(result!.classification.confidence).toBeGreaterThan(0);
    expect(result!.classification.confidence).toBeLessThanOrEqual(0.95);
    expect(result!.regions.length).toBeGreaterThan(0);
  });

  it('returns regions with relative coordinates (basis points 0-10000)', async () => {
    const width = 500;
    const height = 400;
    const data = createBlankImage(width, height);
    paintRedRect(data, width, 100, 80, 60, 40);

    const result = await classifyDiff(data, width, height);
    expect(result).not.toBeNull();

    const region = result!.regions[0];
    expect(region.relX).toBe(2000);
    expect(region.relY).toBe(2000);
    expect(region.relWidth).toBe(1200);
    expect(region.relHeight).toBe(1000);
  });

  it('falls back to heuristic per-region when ONNX unavailable (existing behavior)', async () => {
    const width = 400;
    const height = 300;
    const data = createBlankImage(width, height);
    paintRedRect(data, width, 50, 50, 100, 80);

    const result = await classifyDiff(data, width, height);
    expect(result).not.toBeNull();
    expect(result!.modelVersion).toBeNull();
    // regionCategory should be populated from heuristic
    expect(result!.regions[0].regionCategory).toBeTruthy();
    expect(result!.regions[0].spatialZone).toBeTruthy();
  });

  it('uses ONNX per-region inference when session available, populating regionCategory', async () => {
    // Set up a mock ONNX session that returns predictions
    const mockSession = {
      run: mockRun.mockResolvedValue({
        output: { data: new Float32Array([0.1, 0.2, 0.6, 0.1]) },
      }),
      inputNames: ['input'],
      release: mockRelease,
    };
    mockCreate.mockResolvedValue(mockSession);

    const width = 400;
    const height = 300;
    const data = createBlankImage(width, height);
    paintRedRect(data, width, 50, 50, 100, 80);

    const result = await classifyDiff(data, width, height);
    expect(result).not.toBeNull();
    expect(result!.modelVersion).toBe('unknown');
    // Per-region ONNX gives 'content' (index 2 has highest probability)
    expect(result!.regions[0].regionCategory).toBe('content');
  });

  it('returns rawConfidence separate from calibrated confidence when ONNX used', async () => {
    const mockSession = {
      run: mockRun.mockResolvedValue({
        output: { data: new Float32Array([0.1, 0.2, 0.6, 0.1]) },
      }),
      inputNames: ['input'],
      release: mockRelease,
    };
    mockCreate.mockResolvedValue(mockSession);

    const width = 400;
    const height = 300;
    const data = createBlankImage(width, height);
    paintRedRect(data, width, 50, 50, 100, 80);

    const result = await classifyDiff(data, width, height);
    expect(result).not.toBeNull();
    // rawConfidence should be present when ONNX was used
    expect(result!.rawConfidence).toBeTypeOf('number');
    expect(result!.rawConfidence).toBeGreaterThan(0);
  });

  it('classifies multiple separated regions independently', async () => {
    const width = 800;
    const height = 600;
    const data = createBlankImage(width, height);
    // Top-left region (header area)
    paintRedRect(data, width, 10, 10, 500, 40);
    // Middle region (content area)
    paintRedRect(data, width, 200, 250, 100, 80);

    const result = await classifyDiff(data, width, height);
    expect(result).not.toBeNull();
    expect(result!.regions.length).toBe(2);

    // Each region should have its own classification
    for (const region of result!.regions) {
      expect(region.regionCategory).toBeTruthy();
      expect(region.regionConfidence).toBeGreaterThanOrEqual(0);
      expect(region.regionConfidence).toBeLessThanOrEqual(100);
      expect(region.spatialZone).toBeTruthy();
    }
  });

  it('assigns different spatial zones to regions in different positions', async () => {
    const width = 1000;
    const height = 1000;
    const data = createBlankImage(width, height);
    // Wide region at top (header)
    paintRedRect(data, width, 0, 0, 800, 100);
    // Small region in center (content)
    paintRedRect(data, width, 400, 450, 50, 50);

    const result = await classifyDiff(data, width, height);
    expect(result).not.toBeNull();

    const zones = result!.regions.map(r => r.spatialZone);
    expect(zones).toContain('header');
    expect(zones).toContain('content');
  });

  it('populates all required fields on each region', async () => {
    const width = 400;
    const height = 300;
    const data = createBlankImage(width, height);
    paintRedRect(data, width, 50, 50, 100, 80);

    const result = await classifyDiff(data, width, height);
    const region = result!.regions[0];

    // Structural fields
    expect(region.id).toBeTypeOf('number');
    expect(region.boundingBox).toEqual(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
    }));
    expect(region.pixelCount).toBeGreaterThan(0);

    // Relative coordinates in basis points
    expect(region.relX).toBeGreaterThanOrEqual(0);
    expect(region.relX).toBeLessThanOrEqual(10000);
    expect(region.relY).toBeGreaterThanOrEqual(0);
    expect(region.relY).toBeLessThanOrEqual(10000);

    // Per-region classification
    expect(region.regionCategory).toBeTruthy();
    expect(region.regionConfidence).toBeGreaterThanOrEqual(0);
    expect(region.spatialZone).toBeTruthy();
  });
});
