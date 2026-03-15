import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Region } from '../src/classify/connected-components.js';

// Mock modules before importing
vi.mock('@sentinel/db', () => ({
  classificationOverrides: { diffReportId: 'co.diffReportId', originalCategory: 'co.originalCategory', overrideCategory: 'co.overrideCategory' },
  diffReports: { id: 'dr.id', diffS3Key: 'dr.diffS3Key' },
}));

vi.mock('@sentinel/storage', () => ({
  downloadBuffer: vi.fn(),
}));

vi.mock('sharp', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('../src/classify/connected-components.js', () => ({
  findConnectedComponents: vi.fn(),
}));

vi.mock('../src/classify/region-features.js', () => ({
  extractFeatures: vi.fn(),
}));

// Now import after mocks
import { exportTrainingData, formatPerRegionCsvHeaders, formatPerRegionRow, type PerRegionRow } from './export-training-data.js';
import { downloadBuffer } from '@sentinel/storage';
import sharp from 'sharp';
import { findConnectedComponents } from '../src/classify/connected-components.js';
import { extractFeatures } from '../src/classify/region-features.js';

function createMockDb(overrides: Array<Record<string, unknown>>) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockResolvedValue(overrides),
  };
  return {
    select: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
}

function makeRegion(id: number, opts: Partial<Region> = {}): Region {
  return {
    id,
    pixels: [{ x: 10, y: 10 }],
    boundingBox: { x: 5, y: 5, width: 50, height: 50 },
    pixelCount: 100,
    ...opts,
  };
}

function setupSharpMock(width = 100, height = 100) {
  const rawBuffer = Buffer.alloc(width * height * 4, 0);
  const sharpInstance = {
    raw: vi.fn().mockReturnThis(),
    ensureAlpha: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue({
      data: rawBuffer,
      info: { width, height, channels: 4 },
    }),
  };
  vi.mocked(sharp).mockReturnValue(sharpInstance as unknown as ReturnType<typeof sharp>);
  return sharpInstance;
}

const mockStorageClient = {} as never;
const mockBucket = 'test-bucket';

describe('exportTrainingData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no overrides exist in DB', async () => {
    const db = createMockDb([]);
    const rows = await exportTrainingData(db as never, mockStorageClient, mockBucket);
    expect(rows).toEqual([]);
    expect(db.select).toHaveBeenCalled();
  });

  it('queries classificationOverrides joined with diffReports for S3 keys', async () => {
    const db = createMockDb([]);
    await exportTrainingData(db as never, mockStorageClient, mockBucket);

    expect(db.select).toHaveBeenCalled();
    expect(db._chain.from).toHaveBeenCalled();
    expect(db._chain.innerJoin).toHaveBeenCalled();
  });

  it('downloads diff image from S3, runs findConnectedComponents + extractFeatures, builds 11-element feature vector', async () => {
    const override = {
      diffReportId: 'dr-1',
      originalCategory: 'cosmetic',
      overrideCategory: 'layout',
      diffS3Key: 'diffs/image1.png',
    };
    const db = createMockDb([override]);

    vi.mocked(downloadBuffer).mockResolvedValue(Buffer.from('fake-png'));
    setupSharpMock(200, 200);

    const region = makeRegion(0);
    vi.mocked(findConnectedComponents).mockReturnValue([region]);
    vi.mocked(extractFeatures).mockReturnValue({
      relativeX: 0.1,
      relativeY: 0.1,
      relativeWidth: 0.25,
      relativeHeight: 0.25,
      aspectRatio: 1.0,
      density: 0.5,
      isEdgeAligned: true,
      verticalSpan: 0.25,
      horizontalSpan: 0.25,
    });

    const rows = await exportTrainingData(db as never, mockStorageClient, mockBucket);

    expect(downloadBuffer).toHaveBeenCalledWith(mockStorageClient, mockBucket, 'diffs/image1.png');
    expect(findConnectedComponents).toHaveBeenCalled();
    expect(extractFeatures).toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    expect(rows[0].features).toHaveLength(11);
  });

  it('output row contains features, label, originalLabel, diffReportId', async () => {
    const override = {
      diffReportId: 'dr-2',
      originalCategory: 'style',
      overrideCategory: 'content',
      diffS3Key: 'diffs/image2.png',
    };
    const db = createMockDb([override]);

    vi.mocked(downloadBuffer).mockResolvedValue(Buffer.from('fake-png'));
    setupSharpMock(100, 100);

    vi.mocked(findConnectedComponents).mockReturnValue([makeRegion(0)]);
    vi.mocked(extractFeatures).mockReturnValue({
      relativeX: 0.1, relativeY: 0.1,
      relativeWidth: 0.2, relativeHeight: 0.2,
      aspectRatio: 1.0, density: 0.7,
      isEdgeAligned: false, verticalSpan: 0.2, horizontalSpan: 0.2,
    });

    const rows = await exportTrainingData(db as never, mockStorageClient, mockBucket);

    expect(rows[0]).toEqual({
      features: expect.any(Array),
      label: 'content',
      originalLabel: 'style',
      diffReportId: 'dr-2',
    });
    expect(rows[0].features.every((f: unknown) => typeof f === 'number')).toBe(true);
  });

  it('handles S3 download failure for individual image gracefully (skips row, logs warning)', async () => {
    const overrides = [
      { diffReportId: 'dr-fail', originalCategory: 'cosmetic', overrideCategory: 'layout', diffS3Key: 'diffs/fail.png' },
      { diffReportId: 'dr-ok', originalCategory: 'cosmetic', overrideCategory: 'style', diffS3Key: 'diffs/ok.png' },
    ];
    const db = createMockDb(overrides);

    vi.mocked(downloadBuffer)
      .mockRejectedValueOnce(new Error('S3 timeout'))
      .mockResolvedValueOnce(Buffer.from('fake-png'));

    setupSharpMock(100, 100);
    vi.mocked(findConnectedComponents).mockReturnValue([makeRegion(0)]);
    vi.mocked(extractFeatures).mockReturnValue({
      relativeX: 0.1, relativeY: 0.1,
      relativeWidth: 0.2, relativeHeight: 0.2,
      aspectRatio: 1.0, density: 0.5,
      isEdgeAligned: false, verticalSpan: 0.2, horizontalSpan: 0.2,
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rows = await exportTrainingData(db as never, mockStorageClient, mockBucket);

    expect(rows).toHaveLength(1);
    expect(rows[0].diffReportId).toBe('dr-ok');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('handles image with 0 connected components (skips row)', async () => {
    const override = {
      diffReportId: 'dr-empty',
      originalCategory: 'layout',
      overrideCategory: 'cosmetic',
      diffS3Key: 'diffs/empty.png',
    };
    const db = createMockDb([override]);

    vi.mocked(downloadBuffer).mockResolvedValue(Buffer.from('fake-png'));
    setupSharpMock(100, 100);
    vi.mocked(findConnectedComponents).mockReturnValue([]);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rows = await exportTrainingData(db as never, mockStorageClient, mockBucket);

    expect(rows).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('per-region export', () => {
  it('CSV headers match expected Python training script columns', () => {
    const headers = formatPerRegionCsvHeaders();
    expect(headers).toBe(
      'diffReportId,regionId,x,y,width,height,relX,relY,relWidth,relHeight,pixelCount,spatialZone,regionCategory,regionConfidence,overrideCategory',
    );
  });

  it('formats per-region row with regionCategory, spatialZone, and bounding box', () => {
    const row: PerRegionRow = {
      diffReportId: 'dr-1',
      regionId: 'reg-1',
      x: 10,
      y: 20,
      width: 100,
      height: 200,
      relX: 500,
      relY: 1000,
      relWidth: 5000,
      relHeight: 10000,
      pixelCount: 15000,
      spatialZone: 'header',
      regionCategory: 'layout',
      regionConfidence: 85,
      overrideCategory: '',
    };

    const csv = formatPerRegionRow(row);
    expect(csv).toBe('dr-1,reg-1,10,20,100,200,500,1000,5000,10000,15000,header,layout,85,');
  });

  it('includes override labels when overrides exist', () => {
    const row: PerRegionRow = {
      diffReportId: 'dr-2',
      regionId: 'reg-2',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      relX: 0,
      relY: 0,
      relWidth: 2500,
      relHeight: 2500,
      pixelCount: 2000,
      spatialZone: 'content',
      regionCategory: 'cosmetic',
      regionConfidence: 60,
      overrideCategory: 'layout',
    };

    const csv = formatPerRegionRow(row);
    expect(csv).toContain(',layout');
    // Override category is the last column
    expect(csv.split(',').pop()).toBe('layout');
  });

  it('rows without overrides have empty override columns (not omitted)', () => {
    const row: PerRegionRow = {
      diffReportId: 'dr-3',
      regionId: 'reg-3',
      x: 5,
      y: 5,
      width: 30,
      height: 30,
      relX: 250,
      relY: 250,
      relWidth: 1500,
      relHeight: 1500,
      pixelCount: 500,
      spatialZone: 'sidebar',
      regionCategory: 'style',
      regionConfidence: 72,
      overrideCategory: '',
    };

    const csv = formatPerRegionRow(row);
    const columns = csv.split(',');
    // Should still have 15 columns (same as header count)
    expect(columns).toHaveLength(15);
    // Last column (overrideCategory) should be empty string
    expect(columns[14]).toBe('');
  });
});
