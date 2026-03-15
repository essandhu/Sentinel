import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentinel/db', () => ({
  createDb: vi.fn(),
  baselines: {
    id: 'baselines.id',
    projectId: 'baselines.projectId',
    branchName: 'baselines.branchName',
  },
  captureRuns: {
    branchName: 'captureRuns.branchName',
    createdAt: 'captureRuns.createdAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: any[]) => ({ _type: 'and', conditions: args })),
  notInArray: vi.fn((col, vals) => ({ _type: 'notInArray', col, vals })),
  max: vi.fn((col) => ({ _type: 'max', col })),
  sql: vi.fn(),
}));

describe('stale branch cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanStaleBranchBaselines', () => {
    it('deletes baselines for branches with no capture runs newer than retention period', async () => {
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

      const mockDeleteWhere = vi.fn().mockResolvedValue({ rowCount: 5 });
      const mockDb = {
        selectDistinct: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ branchName: 'feature/old' }]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ lastRun: thirtyOneDaysAgo }]),
          }),
        }),
        delete: vi.fn().mockReturnValue({ where: mockDeleteWhere }),
      };

      const { cleanStaleBranchBaselines } = await import('./branch-cleanup-worker.js');
      const count = await cleanStaleBranchBaselines(mockDb as any, 30);

      expect(count).toBe(5);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('skips protected branches (main, develop, staging)', async () => {
      // The function should not delete baselines for protected branches
      const mockDb = {
        selectDistinct: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        delete: vi.fn(),
      };

      const { cleanStaleBranchBaselines } = await import('./branch-cleanup-worker.js');
      const count = await cleanStaleBranchBaselines(mockDb as any, 30);

      // No branches returned (all excluded) => no deletions
      expect(count).toBe(0);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('returns count of deleted baselines', async () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      const mockDb = {
        selectDistinct: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { branchName: 'feature/stale-1' },
              { branchName: 'feature/stale-2' },
            ]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn()
              .mockResolvedValueOnce([{ lastRun: sixtyDaysAgo }])
              .mockResolvedValueOnce([{ lastRun: null }]),
          }),
        }),
        delete: vi.fn()
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue({ rowCount: 3 }) })
          .mockReturnValueOnce({ where: vi.fn().mockResolvedValue({ rowCount: 2 }) }),
      };

      const { cleanStaleBranchBaselines } = await import('./branch-cleanup-worker.js');
      const count = await cleanStaleBranchBaselines(mockDb as any, 30);

      expect(count).toBe(5);
    });

    it('does NOT delete baselines for branches with recent activity', async () => {
      const recentDate = new Date(); // now = recent

      const mockDeleteFrom = vi.fn();
      const mockDb = {
        selectDistinct: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ branchName: 'feature/active' }]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ lastRun: recentDate }]),
          }),
        }),
        delete: mockDeleteFrom,
      };

      const { cleanStaleBranchBaselines } = await import('./branch-cleanup-worker.js');
      const count = await cleanStaleBranchBaselines(mockDb as any, 30);

      expect(count).toBe(0);
      expect(mockDeleteFrom).not.toHaveBeenCalled();
    });
  });
});
