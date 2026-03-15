import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupBaseline } from './branch-baseline.js';

// Mock drizzle query chain
function createMockDb(results: { branch: Array<{ s3Key: string }>; fallback: Array<{ s3Key: string }> }) {
  let callCount = 0;
  const mockLimit = vi.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 1) return results.branch;
    return results.fallback;
  });
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  return {
    db: { select: mockSelect } as any,
    mocks: { select: mockSelect, from: mockFrom, where: mockWhere, orderBy: mockOrderBy, limit: mockLimit },
    resetCallCount: () => { callCount = 0; },
  };
}

describe('branch-scoped baseline lookup', () => {
  const baseOpts = {
    projectId: 'proj-1',
    url: '/home',
    viewport: '1280x720',
    browser: 'chromium',
    parameterName: '',
    branchName: 'feature/login',
  };

  it('returns branch-specific baseline when one exists for the given branch', async () => {
    const { db } = createMockDb({
      branch: [{ s3Key: 'branch-baseline-key' }],
      fallback: [],
    });

    const result = await lookupBaseline(db, baseOpts);

    expect(result).toEqual({ s3Key: 'branch-baseline-key' });
  });

  it('falls back to main baseline when no branch-specific baseline exists', async () => {
    const { db } = createMockDb({
      branch: [],
      fallback: [{ s3Key: 'main-baseline-key' }],
    });

    const result = await lookupBaseline(db, baseOpts);

    expect(result).toEqual({ s3Key: 'main-baseline-key' });
  });

  it('returns null when no baseline exists on branch or main', async () => {
    const { db } = createMockDb({
      branch: [],
      fallback: [],
    });

    const result = await lookupBaseline(db, baseOpts);

    expect(result).toBeNull();
  });

  it('uses provided parentBranch instead of main when specified', async () => {
    const { db, mocks } = createMockDb({
      branch: [],
      fallback: [{ s3Key: 'develop-baseline-key' }],
    });

    const result = await lookupBaseline(db, {
      ...baseOpts,
      parentBranch: 'develop',
    });

    expect(result).toEqual({ s3Key: 'develop-baseline-key' });
    // The where clause was called twice (once for branch, once for fallback)
    expect(mocks.where).toHaveBeenCalledTimes(2);
  });
});

describe('baseline inheritance', () => {
  it('does not fall back when branchName is already main', async () => {
    const { db, mocks } = createMockDb({
      branch: [],
      fallback: [], // should not be queried
    });

    const result = await lookupBaseline(db, {
      projectId: 'proj-1',
      url: '/home',
      viewport: '1280x720',
      browser: 'chromium',
      parameterName: '',
      branchName: 'main',
    });

    expect(result).toBeNull();
    // Only one query should be made (no fallback since branchName === parentBranch)
    expect(mocks.limit).toHaveBeenCalledTimes(1);
  });
});
