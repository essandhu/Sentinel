import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Mock modules ----------

vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => ({})),
  snapshots: {
    id: 'snapshots.id',
    runId: 'snapshots.runId',
    url: 'snapshots.url',
    viewport: 'snapshots.viewport',
    browser: 'snapshots.browser',
    s3Key: 'snapshots.s3Key',
    capturedAt: 'snapshots.capturedAt',
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.projectId',
    environmentName: 'captureRuns.environmentName',
  },
  environmentDiffs: {
    id: 'environmentDiffs.id',
    projectId: 'environmentDiffs.projectId',
    sourceEnv: 'environmentDiffs.sourceEnv',
    targetEnv: 'environmentDiffs.targetEnv',
    url: 'environmentDiffs.url',
    viewport: 'environmentDiffs.viewport',
    browser: 'environmentDiffs.browser',
    sourceSnapshotId: 'environmentDiffs.sourceSnapshotId',
    targetSnapshotId: 'environmentDiffs.targetSnapshotId',
    diffS3Key: 'environmentDiffs.diffS3Key',
    pixelDiffPercent: 'environmentDiffs.pixelDiffPercent',
    ssimScore: 'environmentDiffs.ssimScore',
    passed: 'environmentDiffs.passed',
    createdAt: 'environmentDiffs.createdAt',
  },
}));

const { mockRunDualDiff } = vi.hoisted(() => ({
  mockRunDualDiff: vi.fn(),
}));
vi.mock('@sentinel-vrt/capture', () => ({
  runDualDiff: mockRunDualDiff,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  desc: vi.fn((...args: unknown[]) => ({ op: 'desc', args })),
  sql: vi.fn((...args: unknown[]) => ({ op: 'sql', args })),
}));

import {
  findLatestEnvSnapshot,
  computeEnvironmentDiff,
  listEnvironmentRoutes,
} from './environment-diff.js';

// ---------- Helpers ----------

const PROJECT_ID = '00000000-0000-4000-a000-000000000700';
const SOURCE_SNAPSHOT_ID = '00000000-0000-4000-a000-000000000701';
const TARGET_SNAPSHOT_ID = '00000000-0000-4000-a000-000000000702';

function buildMockDb(selectResponses: unknown[][] = [], insertResult?: unknown[]) {
  let selectCallIdx = 0;

  const makeSelectChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(fn);
    return chain;
  };

  const makeInsertChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.values = vi.fn(() => chain);
    chain.returning = vi.fn(() => chain);
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(fn);
    return chain;
  };

  return {
    select: vi.fn((..._args: unknown[]) => {
      const response = selectResponses[selectCallIdx] ?? [];
      selectCallIdx++;
      return makeSelectChain(response);
    }),
    selectDistinct: vi.fn((..._args: unknown[]) => {
      const response = selectResponses[selectCallIdx] ?? [];
      selectCallIdx++;
      return makeSelectChain(response);
    }),
    insert: vi.fn(() => makeInsertChain(insertResult ?? [])),
  };
}

function buildMockStorage() {
  return {
    download: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
    upload: vi.fn().mockResolvedValue(undefined),
  };
}

describe('environment-diff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findLatestEnvSnapshot', () => {
    it('returns the most recent snapshot matching projectId+env+url+viewport+browser', async () => {
      const snapshot = {
        id: SOURCE_SNAPSHOT_ID,
        s3Key: 'snapshots/source.png',
        capturedAt: new Date('2026-01-01'),
      };
      const db = buildMockDb([[snapshot]]);

      const result = await findLatestEnvSnapshot(db as any, PROJECT_ID, 'production', '/home', '1920x1080', 'chromium');

      expect(result).toEqual(snapshot);
      expect(db.select).toHaveBeenCalled();
    });

    it('returns null when no snapshot exists for that environment', async () => {
      const db = buildMockDb([[]]);

      const result = await findLatestEnvSnapshot(db as any, PROJECT_ID, 'staging', '/home', '1920x1080', 'chromium');

      expect(result).toBeNull();
    });
  });

  describe('computeEnvironmentDiff', () => {
    it('returns missing_snapshot status when source environment has no data', async () => {
      // First select: findLatestEnvSnapshot for source returns nothing
      // Second select: findLatestEnvSnapshot for target returns a snapshot
      const targetSnap = { id: TARGET_SNAPSHOT_ID, s3Key: 'target.png', capturedAt: new Date() };
      const db = buildMockDb([[], [targetSnap]]);
      const storage = buildMockStorage();

      const result = await computeEnvironmentDiff(db as any, storage as any, 'test-bucket', {
        projectId: PROJECT_ID,
        sourceEnv: 'staging',
        targetEnv: 'production',
        url: '/home',
        viewport: '1920x1080',
        browser: 'chromium',
      });

      expect(result.status).toBe('missing_snapshot');
      expect((result as any).missingEnv).toBe('staging');
    });

    it('returns missing_snapshot status when target environment has no data', async () => {
      const sourceSnap = { id: SOURCE_SNAPSHOT_ID, s3Key: 'source.png', capturedAt: new Date() };
      const db = buildMockDb([[sourceSnap], []]);
      const storage = buildMockStorage();

      const result = await computeEnvironmentDiff(db as any, storage as any, 'test-bucket', {
        projectId: PROJECT_ID,
        sourceEnv: 'staging',
        targetEnv: 'production',
        url: '/home',
        viewport: '1920x1080',
        browser: 'chromium',
      });

      expect(result.status).toBe('missing_snapshot');
      expect((result as any).missingEnv).toBe('production');
    });

    it('calls runDualDiff with correct buffers and returns diff result', async () => {
      const sourceSnap = { id: SOURCE_SNAPSHOT_ID, s3Key: 'source.png', capturedAt: new Date() };
      const targetSnap = { id: TARGET_SNAPSHOT_ID, s3Key: 'target.png', capturedAt: new Date() };
      // selects: source snap, target snap, cache check (empty), then insert
      const db = buildMockDb([[sourceSnap], [targetSnap], []], [{ id: 'new-diff-id' }]);
      const storage = buildMockStorage();

      const diffResult = {
        pixelDiffPercent: 250,
        ssimScore: 9800,
        passed: true,
        diffImageBuffer: Buffer.from('diff-img'),
        rawDiffData: new Uint8ClampedArray(0),
        width: 1920,
        height: 1080,
        layers: { pixel: { diffPercent: 250, diffPixelCount: 100 } },
      };
      mockRunDualDiff.mockResolvedValue(diffResult);

      const result = await computeEnvironmentDiff(db as any, storage as any, 'test-bucket', {
        projectId: PROJECT_ID,
        sourceEnv: 'staging',
        targetEnv: 'production',
        url: '/home',
        viewport: '1920x1080',
        browser: 'chromium',
      });

      expect(result.status).toBe('computed');
      expect((result as any).diff.pixelDiffPercent).toBe(250);
      expect((result as any).diff.ssimScore).toBe(9800);
      expect((result as any).diff.passed).toBe(true);
      expect(mockRunDualDiff).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.any(Buffer),
        { pixelDiffPercent: 100, ssimMin: 9500 },
      );
      expect(storage.upload).toHaveBeenCalled();
    });

    it('serves cached result when both snapshots have not changed', async () => {
      const sourceSnap = { id: SOURCE_SNAPSHOT_ID, s3Key: 'source.png', capturedAt: new Date() };
      const targetSnap = { id: TARGET_SNAPSHOT_ID, s3Key: 'target.png', capturedAt: new Date() };
      const cachedDiff = {
        id: 'cached-diff-id',
        pixelDiffPercent: 150,
        ssimScore: 9900,
        passed: 'true',
        diffS3Key: 'diffs/env/cached.png',
        sourceSnapshotId: SOURCE_SNAPSHOT_ID,
        targetSnapshotId: TARGET_SNAPSHOT_ID,
      };
      // selects: source snap, target snap, cache hit
      const db = buildMockDb([[sourceSnap], [targetSnap], [cachedDiff]]);
      const storage = buildMockStorage();

      const result = await computeEnvironmentDiff(db as any, storage as any, 'test-bucket', {
        projectId: PROJECT_ID,
        sourceEnv: 'staging',
        targetEnv: 'production',
        url: '/home',
        viewport: '1920x1080',
        browser: 'chromium',
      });

      expect(result.status).toBe('cached');
      expect((result as any).diff.pixelDiffPercent).toBe(150);
      expect(mockRunDualDiff).not.toHaveBeenCalled();
      expect(storage.download).not.toHaveBeenCalled();
    });

    it('recomputes when a newer snapshot exists than the cached diff', async () => {
      const sourceSnap = { id: SOURCE_SNAPSHOT_ID, s3Key: 'source.png', capturedAt: new Date() };
      const targetSnap = { id: TARGET_SNAPSHOT_ID, s3Key: 'target.png', capturedAt: new Date() };
      // Cache exists but with different snapshot IDs (older snapshots)
      // selects: source snap, target snap, cache miss (empty = no match for these snapshot IDs)
      const db = buildMockDb([[sourceSnap], [targetSnap], []], [{ id: 'new-diff-id' }]);
      const storage = buildMockStorage();

      const diffResult = {
        pixelDiffPercent: 500,
        ssimScore: 9700,
        passed: false,
        diffImageBuffer: Buffer.from('new-diff'),
        rawDiffData: new Uint8ClampedArray(0),
        width: 1920,
        height: 1080,
        layers: { pixel: { diffPercent: 500, diffPixelCount: 200 } },
      };
      mockRunDualDiff.mockResolvedValue(diffResult);

      const result = await computeEnvironmentDiff(db as any, storage as any, 'test-bucket', {
        projectId: PROJECT_ID,
        sourceEnv: 'staging',
        targetEnv: 'production',
        url: '/home',
        viewport: '1920x1080',
        browser: 'chromium',
      });

      expect(result.status).toBe('computed');
      expect((result as any).diff.pixelDiffPercent).toBe(500);
      expect(mockRunDualDiff).toHaveBeenCalled();
    });
  });

  describe('listEnvironmentRoutes', () => {
    it('returns distinct routes for an environment', async () => {
      const routes = [
        { url: '/home', viewport: '1920x1080', browser: 'chromium' },
        { url: '/about', viewport: '1920x1080', browser: 'chromium' },
      ];
      const db = buildMockDb([routes]);

      const result = await listEnvironmentRoutes(db as any, PROJECT_ID, 'production');

      expect(result).toEqual(routes);
      expect(db.selectDistinct).toHaveBeenCalled();
    });
  });
});
