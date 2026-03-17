import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Test UUIDs ----------
const RUN_ID = '00000000-0000-4000-a000-000000000200';
const DIFF_REPORT_ID = '00000000-0000-4000-a000-000000000201';
const USER_ID = 'user_abc123';

// ---------- Chainable mock DB ----------
function buildMockDb(selectResponses: unknown[][] = [], insertResult?: unknown) {
  let selectCallIdx = 0;

  const makeSelectChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.leftJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(fn);
    return chain;
  };

  const makeInsertChain = (resolveValue: unknown) => {
    const chain: Record<string, any> = {};
    chain.values = vi.fn(() => chain);
    chain.returning = vi.fn(() => chain);
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(fn);
    return chain;
  };

  const db: Record<string, any> = {
    select: vi.fn((..._args: unknown[]) => {
      const response = selectResponses[selectCallIdx] ?? [];
      selectCallIdx++;
      return makeSelectChain(response);
    }),
    insert: vi.fn(() => makeInsertChain(insertResult ?? [])),
  };

  return db;
}

// Mock @sentinel-vrt/db
vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => ({})),
  diffClassifications: {
    id: 'diffClassifications.id',
    diffReportId: 'diffClassifications.diffReportId',
    category: 'diffClassifications.category',
    confidence: 'diffClassifications.confidence',
    reasons: 'diffClassifications.reasons',
    createdAt: 'diffClassifications.createdAt',
  },
  diffRegions: {
    id: 'diffRegions.id',
    diffReportId: 'diffRegions.diffReportId',
    x: 'diffRegions.x',
    y: 'diffRegions.y',
    width: 'diffRegions.width',
    height: 'diffRegions.height',
    relX: 'diffRegions.relX',
    relY: 'diffRegions.relY',
    relWidth: 'diffRegions.relWidth',
    relHeight: 'diffRegions.relHeight',
    pixelCount: 'diffRegions.pixelCount',
    regionCategory: 'diffRegions.regionCategory',
    regionConfidence: 'diffRegions.regionConfidence',
    spatialZone: 'diffRegions.spatialZone',
  },
  layoutShifts: {
    id: 'layoutShifts.id',
    diffReportId: 'layoutShifts.diffReportId',
    $inferSelect: {},
  },
  classificationOverrides: {
    id: 'classificationOverrides.id',
    diffReportId: 'classificationOverrides.diffReportId',
    originalCategory: 'classificationOverrides.originalCategory',
    overrideCategory: 'classificationOverrides.overrideCategory',
    userId: 'classificationOverrides.userId',
    createdAt: 'classificationOverrides.createdAt',
  },
  diffReports: {
    id: 'diffReports.id',
    snapshotId: 'diffReports.snapshotId',
  },
  snapshots: {
    id: 'snapshots.id',
    runId: 'snapshots.runId',
  },
  captureRuns: {
    id: 'captureRuns.id',
  },
}));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  inArray: vi.fn((col, vals) => ({ _type: 'inArray', col, vals })),
}));

import {
  getClassificationsByRunId,
  submitOverride,
} from './classifications.js';

describe('classificationsRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getClassificationsByRunId', () => {
    it('returns empty array when no classifications exist for a run', async () => {
      const db = buildMockDb([
        // Query 0: classifications query returns empty
        [],
      ]);

      const result = await getClassificationsByRunId(db as any, RUN_ID);

      expect(result).toEqual([]);
    });

    it('returns classifications with category, confidence, reasons and nested regions', async () => {
      const db = buildMockDb([
        // Query 0: classifications with joined regions
        [
          {
            diffReportId: DIFF_REPORT_ID,
            category: 'layout',
            confidence: 85,
            reasons: '["header shifted","nav repositioned"]',
            regionId: 'r1',
            x: 10,
            y: 20,
            width: 100,
            height: 50,
            relX: 100,
            relY: 200,
            relWidth: 1000,
            relHeight: 500,
            pixelCount: 5000,
            regionCategory: 'layout',
            regionConfidence: 85,
            spatialZone: 'header',
          },
          {
            diffReportId: DIFF_REPORT_ID,
            category: 'layout',
            confidence: 85,
            reasons: '["header shifted","nav repositioned"]',
            regionId: 'r2',
            x: 50,
            y: 60,
            width: 80,
            height: 40,
            relX: 500,
            relY: 600,
            relWidth: 800,
            relHeight: 400,
            pixelCount: 3200,
            regionCategory: 'layout',
            regionConfidence: 70,
            spatialZone: 'content',
          },
        ],
      ]);

      const result = await getClassificationsByRunId(db as any, RUN_ID);

      expect(result).toHaveLength(1); // One classification (grouped by diffReportId)
      expect(result[0].diffReportId).toBe(DIFF_REPORT_ID);
      expect(result[0].category).toBe('layout');
      expect(result[0].confidence).toBe(85);
      expect(result[0].reasons).toEqual(['header shifted', 'nav repositioned']);
      expect(result[0].regions).toHaveLength(2);
      expect(result[0].regions[0]).toEqual({
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        relX: 100,
        relY: 200,
        relWidth: 1000,
        relHeight: 500,
        pixelCount: 5000,
        regionCategory: 'layout',
        regionConfidence: 85,
        spatialZone: 'header',
      });
    });

    it('handles classifications without regions', async () => {
      const db = buildMockDb([
        [
          {
            diffReportId: DIFF_REPORT_ID,
            category: 'cosmetic',
            confidence: 42,
            reasons: '["minor color change"]',
            regionId: null,
            x: null,
            y: null,
            width: null,
            height: null,
            relX: null,
            relY: null,
            relWidth: null,
            relHeight: null,
            pixelCount: null,
            regionCategory: null,
            regionConfidence: null,
            spatialZone: null,
          },
        ],
      ]);

      const result = await getClassificationsByRunId(db as any, RUN_ID);

      expect(result).toHaveLength(1);
      expect(result[0].regions).toHaveLength(0);
    });
  });

  describe('submitOverride', () => {
    it('stores override with original category from current classification', async () => {
      const overrideRecord = {
        id: 'override-1',
        diffReportId: DIFF_REPORT_ID,
        originalCategory: 'layout',
        overrideCategory: 'style',
        userId: USER_ID,
      };

      const db = buildMockDb(
        [
          // Query 0: look up current classification
          [{ category: 'layout' }],
        ],
        // Insert result
        [overrideRecord],
      );

      const result = await submitOverride(
        db as any,
        DIFF_REPORT_ID,
        'style',
        USER_ID,
      );

      expect(result).toEqual(overrideRecord);
      expect(db.insert).toHaveBeenCalled();
    });

    it('throws when no classification exists for diffReportId', async () => {
      const db = buildMockDb([
        // Query 0: no classification found
        [],
      ]);

      await expect(
        submitOverride(db as any, DIFF_REPORT_ID, 'style', USER_ID),
      ).rejects.toThrow('No classification found');
    });
  });
});
