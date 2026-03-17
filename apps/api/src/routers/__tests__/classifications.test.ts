import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Test UUIDs ----------
const RUN_ID = '00000000-0000-4000-a000-000000000200';
const DIFF_REPORT_ID = '00000000-0000-4000-a000-000000000201';

// ---------- Mock service functions ----------
const mockGetClassificationsByRunId = vi.fn();
const mockSubmitOverride = vi.fn();
const mockGetLayoutShiftsByDiffReportId = vi.fn();

vi.mock('../../services/classification-service.js', () => ({
  getClassificationsByRunId: (...args: unknown[]) => mockGetClassificationsByRunId(...args),
  submitOverride: (...args: unknown[]) => mockSubmitOverride(...args),
  getLayoutShiftsByDiffReportId: (...args: unknown[]) => mockGetLayoutShiftsByDiffReportId(...args),
}));

// Mock @sentinel-vrt/db
vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => ({})),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  desc: vi.fn((col) => ({ _type: 'desc', col })),
}));

// Import router AFTER mocks
import { classificationsRouter } from '../classifications.js';
import { t } from '../../trpc.js';

const createCaller = t.createCallerFactory(classificationsRouter);

describe('classificationsRouter (tRPC procedures)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('byRunId', () => {
    it('delegates to getClassificationsByRunId and returns results', async () => {
      const classifications = [
        {
          diffReportId: DIFF_REPORT_ID,
          category: 'layout',
          confidence: 85,
          reasons: ['header shifted'],
          regions: [],
        },
      ];
      mockGetClassificationsByRunId.mockResolvedValue(classifications);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.byRunId({ runId: RUN_ID });

      expect(result).toEqual(classifications);
      expect(mockGetClassificationsByRunId).toHaveBeenCalledWith(
        expect.anything(), // db
        RUN_ID,
      );
    });

    it('returns empty array when no classifications exist', async () => {
      mockGetClassificationsByRunId.mockResolvedValue([]);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.byRunId({ runId: RUN_ID });

      expect(result).toEqual([]);
    });

    it('rejects non-uuid runId', async () => {
      const caller = createCaller({ auth: null } as any);

      await expect(
        caller.byRunId({ runId: 'not-a-uuid' }),
      ).rejects.toThrow();
    });
  });

  describe('layoutShifts', () => {
    it('delegates to getLayoutShiftsByDiffReportId and returns results', async () => {
      const shifts = [
        { id: 'ls-1', diffReportId: DIFF_REPORT_ID, element: '.header', shiftDistance: 15 },
      ];
      mockGetLayoutShiftsByDiffReportId.mockResolvedValue(shifts);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.layoutShifts({ diffReportId: DIFF_REPORT_ID });

      expect(result).toEqual(shifts);
      expect(mockGetLayoutShiftsByDiffReportId).toHaveBeenCalledWith(
        expect.anything(), // db
        DIFF_REPORT_ID,
      );
    });

    it('returns empty array when no layout shifts exist', async () => {
      mockGetLayoutShiftsByDiffReportId.mockResolvedValue([]);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.layoutShifts({ diffReportId: DIFF_REPORT_ID });

      expect(result).toEqual([]);
    });

    it('rejects non-uuid diffReportId', async () => {
      const caller = createCaller({ auth: null } as any);

      await expect(
        caller.layoutShifts({ diffReportId: 'invalid' }),
      ).rejects.toThrow();
    });
  });

  describe('override', () => {
    it('delegates to submitOverride with userId from context', async () => {
      const overrideResult = {
        id: 'override-1',
        diffReportId: DIFF_REPORT_ID,
        originalCategory: 'layout',
        overrideCategory: 'style',
        userId: 'user-123',
      };
      mockSubmitOverride.mockResolvedValue(overrideResult);

      const caller = createCaller({
        auth: { userId: 'user-123', orgId: 'org-1', orgRole: 'org:member' },
      } as any);
      const result = await caller.override({
        diffReportId: DIFF_REPORT_ID,
        overrideCategory: 'style',
      });

      expect(result).toEqual(overrideResult);
      expect(mockSubmitOverride).toHaveBeenCalledWith(
        expect.anything(), // db
        DIFF_REPORT_ID,
        'style',
        'user-123',
      );
    });

    it('uses anonymous when auth is null', async () => {
      mockSubmitOverride.mockResolvedValue({ id: 'override-2' });

      const caller = createCaller({ auth: null } as any);
      await caller.override({
        diffReportId: DIFF_REPORT_ID,
        overrideCategory: 'cosmetic',
      });

      expect(mockSubmitOverride).toHaveBeenCalledWith(
        expect.anything(),
        DIFF_REPORT_ID,
        'cosmetic',
        'anonymous',
      );
    });

    it('rejects invalid category enum value', async () => {
      const caller = createCaller({ auth: null } as any);

      await expect(
        caller.override({
          diffReportId: DIFF_REPORT_ID,
          overrideCategory: 'invalid-category' as any,
        }),
      ).rejects.toThrow();
    });

    it('accepts all valid category values: layout, style, content, cosmetic', async () => {
      mockSubmitOverride.mockResolvedValue({ id: 'override-x' });

      const caller = createCaller({ auth: null } as any);

      for (const category of ['layout', 'style', 'content', 'cosmetic'] as const) {
        await expect(
          caller.override({
            diffReportId: DIFF_REPORT_ID,
            overrideCategory: category,
          }),
        ).resolves.toBeDefined();
      }

      expect(mockSubmitOverride).toHaveBeenCalledTimes(4);
    });

    it('rejects non-uuid diffReportId', async () => {
      const caller = createCaller({ auth: null } as any);

      await expect(
        caller.override({
          diffReportId: 'not-a-uuid',
          overrideCategory: 'style',
        }),
      ).rejects.toThrow();
    });
  });
});
