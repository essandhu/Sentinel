import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreateDb = vi.hoisted(() => vi.fn());

vi.mock('@sentinel/db', () => ({
  createDb: mockCreateDb,
  baselines: {
    id: 'baselines.id',
    projectId: 'baselines.projectId',
    branchName: 'baselines.branchName',
    url: 'baselines.url',
    viewport: 'baselines.viewport',
    browser: 'baselines.browser',
    parameterName: 'baselines.parameterName',
    s3Key: 'baselines.s3Key',
    snapshotId: 'baselines.snapshotId',
    approvedBy: 'baselines.approvedBy',
    createdAt: 'baselines.createdAt',
  },
  projects: {
    id: 'projects.id',
    name: 'projects.name',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: any[]) => ({ _type: 'and', conditions: args })),
}));

describe('merge baseline promotion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('promoteBaselines', () => {
    it('copies all feature-branch baselines to target branch with new IDs and updated branchName', async () => {
      const featureBaselines = [
        {
          id: 'old-id-1',
          projectId: 'proj-1',
          url: '/page-a',
          viewport: '1280x720',
          browser: 'chromium',
          parameterName: '',
          branchName: 'feature/login',
          s3Key: 'baselines/old-1.png',
          snapshotId: 'snap-1',
          approvedBy: 'user-1',
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'old-id-2',
          projectId: 'proj-1',
          url: '/page-b',
          viewport: '375x667',
          browser: 'chromium',
          parameterName: '',
          branchName: 'feature/login',
          s3Key: 'baselines/old-2.png',
          snapshotId: 'snap-2',
          approvedBy: 'user-1',
          createdAt: new Date('2026-01-01'),
        },
      ];

      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
      const mockWhere = vi.fn().mockResolvedValue(featureBaselines);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      const mockDb = {
        select: mockSelect,
        insert: mockInsert,
        transaction: vi.fn(async (fn: any) => fn({ select: mockSelect, insert: mockInsert })),
      };

      const { promoteBaselines } = await import('./github-merge-handler.js');
      const count = await promoteBaselines(mockDb as any, 'proj-1', 'feature/login', 'main');

      expect(count).toBe(2);
      expect(mockInsertValues).toHaveBeenCalledTimes(2);
      // Verify each inserted row has target branch, not feature branch
      for (const call of mockInsertValues.mock.calls) {
        expect(call[0].branchName).toBe('main');
        expect(call[0].id).not.toBe('old-id-1');
        expect(call[0].id).not.toBe('old-id-2');
      }
    });

    it('returns count of promoted baselines', async () => {
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
      const mockWhere = vi.fn().mockResolvedValue([
        { id: 'b1', projectId: 'p1', url: '/a', viewport: '1280x720', browser: 'chromium', parameterName: '', branchName: 'feat', s3Key: 'k1', snapshotId: 's1', approvedBy: 'u', createdAt: new Date() },
      ]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      const mockDb = {
        select: mockSelect,
        insert: mockInsert,
        transaction: vi.fn(async (fn: any) => fn({ select: mockSelect, insert: mockInsert })),
      };

      const { promoteBaselines } = await import('./github-merge-handler.js');
      const count = await promoteBaselines(mockDb as any, 'p1', 'feat', 'main');
      expect(count).toBe(1);
    });
  });

  describe('handleGitHubMerge', () => {
    it('ignores non-merge events (PR closed without merge)', async () => {
      const mockDb = { select: vi.fn() };
      const payload = {
        action: 'closed',
        pull_request: { merged: false, head: { ref: 'feat' }, base: { ref: 'main' } },
        repository: { full_name: 'org/repo' },
      };

      const { handleGitHubMerge } = await import('./github-merge-handler.js');
      const result = await handleGitHubMerge(payload, mockDb as any);

      expect(result).toEqual({ promoted: 0, skipped: true });
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('extracts correct branch names from webhook payload', async () => {
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
      const mockWhere = vi.fn();
      const mockLimit = vi.fn();
      const mockFrom = vi.fn();

      // First call: project lookup => found
      // Second call (inside transaction): baselines lookup => empty
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // project lookup
          return {
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'proj-1', name: 'org/repo' }]),
            }),
          };
        }
        // baselines lookup (inside transaction)
        return { where: vi.fn().mockResolvedValue([]) };
      });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      const mockDb = {
        select: mockSelect,
        insert: mockInsert,
        transaction: vi.fn(async (fn: any) => fn({ select: mockSelect, insert: mockInsert })),
      };

      const payload = {
        action: 'closed',
        pull_request: { merged: true, head: { ref: 'feature/awesome-thing' }, base: { ref: 'develop' } },
        repository: { full_name: 'org/repo' },
      };

      const { handleGitHubMerge } = await import('./github-merge-handler.js');
      const result = await handleGitHubMerge(payload, mockDb as any);

      // Should have looked up the project and attempted baseline promotion
      expect(mockSelect).toHaveBeenCalled();
      expect(result.skipped).toBeFalsy();
    });

    it('resolves projectId from repository full_name', async () => {
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

      let callCount = 0;
      const mockFrom = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'proj-abc', name: 'myorg/myrepo' }]),
            }),
          };
        }
        return { where: vi.fn().mockResolvedValue([]) };
      });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      const mockDb = {
        select: mockSelect,
        insert: mockInsert,
        transaction: vi.fn(async (fn: any) => fn({ select: mockSelect, insert: mockInsert })),
      };

      const payload = {
        action: 'closed',
        pull_request: { merged: true, head: { ref: 'feat/x' }, base: { ref: 'main' } },
        repository: { full_name: 'myorg/myrepo' },
      };

      const { handleGitHubMerge } = await import('./github-merge-handler.js');
      const result = await handleGitHubMerge(payload, mockDb as any);

      // First select should have been project lookup
      expect(mockSelect).toHaveBeenCalled();
      expect(result.promoted).toBe(0); // no baselines to promote
    });
  });
});
