import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Test UUIDs ----------
const PROJ_ID = '00000000-0000-4000-a000-000000000001';
const PROJ_ID_2 = '00000000-0000-4000-a000-000000000002';
const COMP_ID_A = '00000000-0000-4000-a000-000000000010';
const COMP_ID_B = '00000000-0000-4000-a000-000000000011';

// ---------- Mock factories (vi.hoisted) ----------
const mockStorageClient = {};
const mockBucket = 'test-bucket';
const mockDownloadBuffer = vi.fn();
const mockRunDualDiff = vi.fn();

vi.mock('@sentinel-vrt/storage', () => ({
  downloadBuffer: (...args: unknown[]) => mockDownloadBuffer(...args),
}));

vi.mock('@sentinel-vrt/capture', () => ({
  runDualDiff: (...args: unknown[]) => mockRunDualDiff(...args),
}));

const mockComputeAveragePerfScore = vi.fn();
vi.mock('./lighthouse-query-service.js', () => ({
  computeAveragePerfScore: (...args: unknown[]) => mockComputeAveragePerfScore(...args),
}));

// ---------- Chainable mock DB ----------
function buildMockDb(selectResponses: unknown[][] = []) {
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

  const db: Record<string, any> = {
    select: vi.fn((..._args: unknown[]) => {
      const response = selectResponses[selectCallIdx] ?? [];
      selectCallIdx++;
      return makeSelectChain(response);
    }),
    insert: vi.fn(() => {
      const chain: Record<string, any> = {};
      chain.values = vi.fn(() => chain);
      chain.returning = vi.fn();
      chain.then = (fn: (v: unknown) => unknown) =>
        Promise.resolve(undefined).then(fn);
      return chain;
    }),
    delete: vi.fn(() => {
      const chain: Record<string, any> = {};
      chain.where = vi.fn(() => chain);
      chain.then = (fn: (v: unknown) => unknown) =>
        Promise.resolve(undefined).then(fn);
      return chain;
    }),
  };

  return db;
}

// Mock @sentinel-vrt/db -- must be before import
vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(),
  projects: { id: 'projects.id', workspaceId: 'projects.workspaceId' },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.projectId',
    status: 'captureRuns.status',
    createdAt: 'captureRuns.createdAt',
    completedAt: 'captureRuns.completedAt',
  },
  a11yViolations: {
    id: 'a11yViolations.id',
    captureRunId: 'a11yViolations.captureRunId',
    projectId: 'a11yViolations.projectId',
    url: 'a11yViolations.url',
    viewport: 'a11yViolations.viewport',
    browser: 'a11yViolations.browser',
    isNew: 'a11yViolations.isNew',
    fingerprint: 'a11yViolations.fingerprint',
  },
  snapshots: {
    id: 'snapshots.id',
    runId: 'snapshots.runId',
    url: 'snapshots.url',
    s3Key: 'snapshots.s3Key',
    componentId: 'snapshots.componentId',
    capturedAt: 'snapshots.capturedAt',
  },
  diffReports: {
    id: 'diffReports.id',
    snapshotId: 'diffReports.snapshotId',
    passed: 'diffReports.passed',
    createdAt: 'diffReports.createdAt',
  },
  components: {
    id: 'components.id',
    projectId: 'components.projectId',
    name: 'components.name',
    enabled: 'components.enabled',
  },
  healthScores: {
    id: 'healthScores.id',
    projectId: 'healthScores.projectId',
    componentId: 'healthScores.componentId',
    score: 'healthScores.score',
    windowDays: 'healthScores.windowDays',
    computedAt: 'healthScores.computedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  gte: vi.fn((a, b) => ({ _type: 'gte', a, b })),
  lt: vi.fn((a, b) => ({ _type: 'lt', a, b })),
  isNull: vi.fn((a) => ({ _type: 'isNull', a })),
  isNotNull: vi.fn((a) => ({ _type: 'isNotNull', a })),
  count: vi.fn(() => 'count(*)'),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
    { raw: vi.fn((s: string) => ({ _type: 'sql_raw', s })) },
  ),
}));

import {
  computeProjectHealthScore,
  computeComponentHealthScores,
  computeAllHealthScores,
  computeA11yScore,
} from './health-score-service.js';

describe('health-score-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeAveragePerfScore.mockResolvedValue(-1);
  });

  // ---------- computeProjectHealthScore ----------
  describe('computeProjectHealthScore', () => {
    it('returns 95 when 95 of 100 diffs passed', async () => {
      const db = buildMockDb([
        [{ total: '100', passed: '95' }], // PostgreSQL count returns strings
      ]);

      const result = await computeProjectHealthScore(db as any, PROJ_ID, 30);
      expect(result).toBe(95);
    });

    it('returns -1 when 0 diffs in window (no data sentinel)', async () => {
      const db = buildMockDb([
        [{ total: '0', passed: '0' }],
      ]);

      const result = await computeProjectHealthScore(db as any, PROJ_ID, 30);
      expect(result).toBe(-1);
    });

    it('returns 100 when all diffs passed', async () => {
      const db = buildMockDb([
        [{ total: '50', passed: '50' }],
      ]);

      const result = await computeProjectHealthScore(db as any, PROJ_ID, 30);
      expect(result).toBe(100);
    });

    it('returns 0 when no diffs passed', async () => {
      const db = buildMockDb([
        [{ total: '20', passed: '0' }],
      ]);

      const result = await computeProjectHealthScore(db as any, PROJ_ID, 30);
      expect(result).toBe(0);
    });
  });

  // ---------- computeComponentHealthScores ----------
  describe('computeComponentHealthScores', () => {
    it('blends 70% diff pass rate + 30% consistency rate', async () => {
      // select[0] = enabled components
      // select[1] = component diff stats (comp A)
      // select[2] = component snapshots (comp A) for consistency
      // select[3] = project URLs for consistency (comp A)
      const db = buildMockDb([
        [{ id: COMP_ID_A, projectId: PROJ_ID, name: 'Header', enabled: 1 }],
        [{ total: '10', passed: '8' }], // 80% pass rate
        // Snapshots for consistency: 2 URLs both consistent
        [
          { id: 's1', url: 'https://a.com', s3Key: 'key-a', capturedAt: new Date() },
          { id: 's2', url: 'https://b.com', s3Key: 'key-b', capturedAt: new Date() },
        ],
        // Project URLs
        [{ url: 'https://a.com' }, { url: 'https://b.com' }],
      ]);

      // All consistency checks pass
      mockDownloadBuffer.mockResolvedValue(Buffer.from('img'));
      mockRunDualDiff.mockResolvedValue({ passed: true });

      const result = await computeComponentHealthScores(db as any, PROJ_ID, 30, {
        storageClient: mockStorageClient as any,
        bucket: mockBucket,
      });

      expect(result).toHaveLength(1);
      // 80 * 0.7 + 100 * 0.3 = 56 + 30 = 86
      expect(result[0].score).toBe(86);
      expect(result[0].componentId).toBe(COMP_ID_A);
      expect(result[0].componentName).toBe('Header');
    });

    it('penalizes inconsistent component (lower than pure pass rate)', async () => {
      const db = buildMockDb([
        [{ id: COMP_ID_A, projectId: PROJ_ID, name: 'Header', enabled: 1 }],
        [{ total: '10', passed: '10' }], // 100% pass rate
        // Snapshots for consistency: 2 URLs, one inconsistent
        [
          { id: 's1', url: 'https://a.com', s3Key: 'key-a', capturedAt: new Date() },
          { id: 's2', url: 'https://b.com', s3Key: 'key-b', capturedAt: new Date() },
        ],
        [{ url: 'https://a.com' }, { url: 'https://b.com' }],
      ]);

      mockDownloadBuffer.mockResolvedValue(Buffer.from('img'));
      // First comparison: inconsistent
      mockRunDualDiff.mockResolvedValue({ passed: false });

      const result = await computeComponentHealthScores(db as any, PROJ_ID, 30, {
        storageClient: mockStorageClient as any,
        bucket: mockBucket,
      });

      expect(result).toHaveLength(1);
      // 100% pass rate but 50% consistency (1 of 2 URLs consistent, reference is always consistent)
      // 100 * 0.7 + 50 * 0.3 = 70 + 15 = 85
      expect(result[0].score).toBe(85);
      // Score should be less than 100 (pure pass rate)
      expect(result[0].score).toBeLessThan(100);
    });

    it('returns -1 for component with no diffs', async () => {
      const db = buildMockDb([
        [{ id: COMP_ID_A, projectId: PROJ_ID, name: 'Header', enabled: 1 }],
        [{ total: '0', passed: '0' }], // No diffs
        [],
        [],
      ]);

      const result = await computeComponentHealthScores(db as any, PROJ_ID, 30, {
        storageClient: mockStorageClient as any,
        bucket: mockBucket,
      });

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(-1);
    });
  });

  // ---------- computeA11yScore ----------
  describe('computeA11yScore', () => {
    it('returns -1 when no a11y data exists (no capture runs with violations)', async () => {
      const db = buildMockDb([
        // Query 0: most recent capture run
        [{ id: '00000000-0000-4000-a000-000000000100' }],
        // Query 1: distinct url/viewport/browser combos -- none
        [],
      ]);

      const result = await computeA11yScore(db as any, PROJ_ID);
      expect(result).toBe(-1);
    });

    it('returns 100 when all route combos have zero new violations', async () => {
      const db = buildMockDb([
        // Query 0: most recent capture run
        [{ id: '00000000-0000-4000-a000-000000000100' }],
        // Query 1: distinct combos (all routes)
        [
          { url: 'https://a.com', viewport: '1920x1080', browser: 'chromium' },
          { url: 'https://b.com', viewport: '1920x1080', browser: 'chromium' },
        ],
        // Query 2: combos with new violations -- none
        [],
      ]);

      const result = await computeA11yScore(db as any, PROJ_ID);
      expect(result).toBe(100);
    });

    it('returns correct percentage when some combos have new violations', async () => {
      const db = buildMockDb([
        // Query 0: most recent capture run
        [{ id: '00000000-0000-4000-a000-000000000100' }],
        // Query 1: 4 total distinct combos
        [
          { url: 'https://a.com', viewport: '1920x1080', browser: 'chromium' },
          { url: 'https://b.com', viewport: '1920x1080', browser: 'chromium' },
          { url: 'https://c.com', viewport: '1920x1080', browser: 'chromium' },
          { url: 'https://d.com', viewport: '1920x1080', browser: 'chromium' },
        ],
        // Query 2: 1 combo with new violations
        [
          { url: 'https://a.com', viewport: '1920x1080', browser: 'chromium' },
        ],
      ]);

      const result = await computeA11yScore(db as any, PROJ_ID);
      // 3 clean out of 4 total = 75%
      expect(result).toBe(75);
    });

    it('returns -1 when no capture runs exist for project', async () => {
      const db = buildMockDb([
        // Query 0: no capture runs
        [],
      ]);

      const result = await computeA11yScore(db as any, PROJ_ID);
      expect(result).toBe(-1);
    });
  });

  // ---------- computeProjectHealthScore with a11y ----------
  describe('computeProjectHealthScore with a11y blending', () => {
    it('uses existing formula (diff-only) when a11yScore is undefined', async () => {
      const db = buildMockDb([
        [{ total: '100', passed: '80' }],
      ]);

      const result = await computeProjectHealthScore(db as any, PROJ_ID, 30);
      expect(result).toBe(80); // Pure diff pass rate
    });

    it('uses existing formula when a11yScore is -1', async () => {
      const db = buildMockDb([
        [{ total: '100', passed: '80' }],
      ]);

      const result = await computeProjectHealthScore(db as any, PROJ_ID, 30, -1);
      expect(result).toBe(80); // Pure diff pass rate
    });

    it('blends 70% diff + 30% a11y when a11yScore >= 0', async () => {
      const db = buildMockDb([
        [{ total: '100', passed: '80' }], // 80% diff pass rate
      ]);

      const result = await computeProjectHealthScore(db as any, PROJ_ID, 30, 100);
      // 80 * 0.7 + 100 * 0.3 = 56 + 30 = 86
      expect(result).toBe(86);
    });
  });

  // ---------- computeComponentHealthScores with a11y ----------
  describe('computeComponentHealthScores with a11y blending', () => {
    it('uses 50/25/25 blend when a11yScore >= 0', async () => {
      const db = buildMockDb([
        [{ id: COMP_ID_A, projectId: PROJ_ID, name: 'Header', enabled: 1 }],
        [{ total: '10', passed: '8' }], // 80% diff pass rate
        [
          { id: 's1', url: 'https://a.com', s3Key: 'key-a', capturedAt: new Date() },
          { id: 's2', url: 'https://b.com', s3Key: 'key-b', capturedAt: new Date() },
        ],
        [{ url: 'https://a.com' }, { url: 'https://b.com' }],
      ]);

      mockDownloadBuffer.mockResolvedValue(Buffer.from('img'));
      mockRunDualDiff.mockResolvedValue({ passed: true }); // 100% consistency

      const result = await computeComponentHealthScores(db as any, PROJ_ID, 30, {
        storageClient: mockStorageClient as any,
        bucket: mockBucket,
      }, 90); // a11yScore = 90

      expect(result).toHaveLength(1);
      // 80 * 0.5 + 100 * 0.25 + 90 * 0.25 = 40 + 25 + 22.5 = 87.5 => 88
      expect(result[0].score).toBe(88);
    });

    it('uses 70/30 blend when a11yScore is -1', async () => {
      const db = buildMockDb([
        [{ id: COMP_ID_A, projectId: PROJ_ID, name: 'Header', enabled: 1 }],
        [{ total: '10', passed: '8' }], // 80% diff pass rate
        [
          { id: 's1', url: 'https://a.com', s3Key: 'key-a', capturedAt: new Date() },
          { id: 's2', url: 'https://b.com', s3Key: 'key-b', capturedAt: new Date() },
        ],
        [{ url: 'https://a.com' }, { url: 'https://b.com' }],
      ]);

      mockDownloadBuffer.mockResolvedValue(Buffer.from('img'));
      mockRunDualDiff.mockResolvedValue({ passed: true }); // 100% consistency

      const result = await computeComponentHealthScores(db as any, PROJ_ID, 30, {
        storageClient: mockStorageClient as any,
        bucket: mockBucket,
      }, -1);

      expect(result).toHaveLength(1);
      // 80 * 0.7 + 100 * 0.3 = 56 + 30 = 86 (same as existing)
      expect(result[0].score).toBe(86);
    });
  });

  // ---------- computeProjectHealthScore with perf blending ----------
  describe('computeProjectHealthScore with perf blending', () => {
    it('blends 50% diff + 25% a11y + 25% perf when both available', async () => {
      const db = buildMockDb([
        [{ total: '100', passed: '80' }], // 80% diff pass rate
      ]);

      // a11yScore=100, perfScore=60 => 80*0.5 + 100*0.25 + 60*0.25 = 40+25+15 = 80
      const result = await computeProjectHealthScore(db as any, PROJ_ID, 30, 100, 60);
      expect(result).toBe(80);
    });

    it('blends 70% diff + 30% perf when only perf available', async () => {
      const db = buildMockDb([
        [{ total: '100', passed: '80' }], // 80% diff pass rate
      ]);

      // perfScore=60, no a11y => 80*0.7 + 60*0.3 = 56+18 = 74
      const result = await computeProjectHealthScore(db as any, PROJ_ID, 30, undefined, 60);
      expect(result).toBe(74);
    });

    it('backward compatible when perfScore is undefined', async () => {
      const db = buildMockDb([
        [{ total: '100', passed: '80' }],
      ]);

      const result = await computeProjectHealthScore(db as any, PROJ_ID, 30, 100);
      // 80*0.7 + 100*0.3 = 56+30 = 86 (existing behavior)
      expect(result).toBe(86);
    });
  });

  // ---------- computeComponentHealthScores with perf blending ----------
  describe('computeComponentHealthScores with perf blending', () => {
    it('uses 40/20/20/20 blend when both a11y and perf available', async () => {
      const db = buildMockDb([
        [{ id: COMP_ID_A, projectId: PROJ_ID, name: 'Header', enabled: 1 }],
        [{ total: '10', passed: '8' }], // 80% diff pass rate
        [
          { id: 's1', url: 'https://a.com', s3Key: 'key-a', capturedAt: new Date() },
          { id: 's2', url: 'https://b.com', s3Key: 'key-b', capturedAt: new Date() },
        ],
        [{ url: 'https://a.com' }, { url: 'https://b.com' }],
      ]);

      mockDownloadBuffer.mockResolvedValue(Buffer.from('img'));
      mockRunDualDiff.mockResolvedValue({ passed: true }); // 100% consistency

      // a11yScore=90, perfScore=60 => 80*0.4 + 100*0.2 + 90*0.2 + 60*0.2 = 32+20+18+12 = 82
      const result = await computeComponentHealthScores(db as any, PROJ_ID, 30, {
        storageClient: mockStorageClient as any,
        bucket: mockBucket,
      }, 90, 60);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(82);
    });

    it('uses 50/25/25 blend with perf only (no a11y)', async () => {
      const db = buildMockDb([
        [{ id: COMP_ID_A, projectId: PROJ_ID, name: 'Header', enabled: 1 }],
        [{ total: '10', passed: '8' }], // 80% diff pass rate
        [
          { id: 's1', url: 'https://a.com', s3Key: 'key-a', capturedAt: new Date() },
          { id: 's2', url: 'https://b.com', s3Key: 'key-b', capturedAt: new Date() },
        ],
        [{ url: 'https://a.com' }, { url: 'https://b.com' }],
      ]);

      mockDownloadBuffer.mockResolvedValue(Buffer.from('img'));
      mockRunDualDiff.mockResolvedValue({ passed: true }); // 100% consistency

      // perfScore=60, no a11y => 80*0.5 + 100*0.25 + 60*0.25 = 40+25+15 = 80
      const result = await computeComponentHealthScores(db as any, PROJ_ID, 30, {
        storageClient: mockStorageClient as any,
        bucket: mockBucket,
      }, undefined, 60);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(80);
    });
  });

  // ---------- computeAllHealthScores ----------
  describe('computeAllHealthScores', () => {
    it('only processes projects with captures in last 30 days (active projects)', async () => {
      // select[0] = active projects
      // Then for each project: project score query + component queries + insert + cleanup
      const db = buildMockDb([
        // Active projects (distinct project IDs with recent captures)
        [{ projectId: PROJ_ID }],
        // Project score query
        [{ total: '10', passed: '9' }],
        // Component queries: no enabled components
        [],
      ]);

      await computeAllHealthScores(db as any, {
        storageClient: mockStorageClient as any,
        bucket: mockBucket,
      });

      // Should have called insert for the project score
      expect(db.insert).toHaveBeenCalled();
    });

    it('writes project-level scores (componentId=null) and per-component scores', async () => {
      const db = buildMockDb([
        // Active projects
        [{ projectId: PROJ_ID }],
        // Project health score
        [{ total: '100', passed: '90' }],
        // Enabled components
        [{ id: COMP_ID_A, projectId: PROJ_ID, name: 'Header', enabled: 1 }],
        // Component diff stats
        [{ total: '10', passed: '8' }],
        // Component consistency snapshots
        [],
        // Project URLs for consistency
        [],
      ]);

      await computeAllHealthScores(db as any, {
        storageClient: mockStorageClient as any,
        bucket: mockBucket,
      });

      // insert should be called (project-level + component-level)
      expect(db.insert).toHaveBeenCalled();
    });

    it('deletes health_scores rows older than 90 days (retention cleanup)', async () => {
      const db = buildMockDb([
        // No active projects
        [],
      ]);

      await computeAllHealthScores(db as any, {
        storageClient: mockStorageClient as any,
        bucket: mockBucket,
      });

      // Cleanup should still run even when no active projects
      expect(db.delete).toHaveBeenCalled();
    });
  });
});
