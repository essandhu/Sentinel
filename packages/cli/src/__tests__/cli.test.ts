import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Mock @sentinel-vrt/capture
vi.mock('@sentinel-vrt/capture', () => ({
  loadConfig: vi.fn(),
  processCaptureLocal: vi.fn().mockResolvedValue(undefined),
}));

// Mock @sentinel-vrt/db
const mockInsertReturning = vi.fn();
const mockSelectWhere = vi.fn();

const mockOrderBy = vi.fn();

const mockDb = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: mockInsertReturning,
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: mockSelectWhere,
  innerJoin: vi.fn().mockReturnThis(),
  orderBy: mockOrderBy,
  run: vi.fn(),
  all: vi.fn(),
};

vi.mock('@sentinel-vrt/db', () => ({
  createSqliteDb: vi.fn(() => mockDb),
  sqliteSchema: {
    projects: { name: 'projects' },
    captureRuns: { name: 'captureRuns' },
    snapshots: { name: 'snapshots' },
    diffReports: { name: 'diffReports' },
    lighthouseScores: { name: 'lighthouseScores' },
    testPlanRuns: { name: 'testPlanRuns' },
  },
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, val) => ({ field, val })),
  and: vi.fn((...args) => ({ and: args })),
  gte: vi.fn((field, val) => ({ gte: { field, val } })),
  asc: vi.fn((field) => ({ asc: field })),
}));

// Mock @sentinel-vrt/storage
const mockStorage = { ensureReady: vi.fn().mockResolvedValue(undefined) };
vi.mock('@sentinel-vrt/storage', () => ({
  FilesystemStorageAdapter: vi.fn(function () { return mockStorage; }),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { runCapture } from '../commands/capture-local.js';
import { loadConfig, processCaptureLocal } from '@sentinel-vrt/capture';
import { createSqliteDb } from '@sentinel-vrt/db';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    project: 'my-project',
    baseUrl: 'http://localhost:3000',
    capture: {
      routes: [
        { path: '/home', name: 'home' },
        { path: '/about', name: 'about' },
      ],
      viewports: ['1280x720'],
    },
    ...overrides,
  };
}

const PROJECT_ID = 'proj-uuid-1234';
const CAPTURE_RUN_ID = 'run-uuid-5678';

function setupDbMocks({
  existingProject = null as null | { id: string; name: string },
  diffReports = [] as Array<{
    url: string;
    viewport: string;
    pixelDiffPercent: number | null;
    ssimScore: number | null;
    passed: string;
    diffStorageKey: string;
  }>,
  lighthouseScoreRows = undefined as undefined | Array<{
    url: string;
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  }>,
  stabilityRows = undefined as undefined | Array<{
    url: string;
    viewport: string;
    browser: string;
    parameterName: string;
    passed: string;
    createdAt: Date;
  }>,
} = {}) {
  // selectWhere controls what's returned for project lookup, diffReports, and lighthouseScores
  // Call sequence: 1=project, 2=diffReports, 3=lighthouseScores (if thresholds configured)
  // Stability query ends with orderBy, not where
  // Track which where() call we're on to return the right data.
  // Budget-enabled flows: 1=project, 2=diffReports, 3=lighthouseScores, 4=stability(chainable)
  // No-budget flows:      1=project, 2=diffReports, 3=stability(chainable)
  // We detect stability query by checking if it needs orderBy chaining.
  // Solution: return a thenable+chainable hybrid for stability query.
  let selectCallCount = 0;
  const selectResponses: Array<unknown> = [
    // Call 1: project lookup
    existingProject ? [existingProject] : [],
    // Call 2: diffReports with join
    diffReports,
  ];
  // Call 3: if lighthouseScoreRows is defined, it's the LH query; otherwise stability
  if (lighthouseScoreRows !== undefined) {
    selectResponses.push(lighthouseScoreRows);
  }
  // Final call (3 or 4): stability query — needs .orderBy() chaining
  // We use a special marker

  mockSelectWhere.mockImplementation(() => {
    selectCallCount++;
    if (selectCallCount <= selectResponses.length) {
      const data = selectResponses[selectCallCount - 1];
      return {
        all: vi.fn(() => data),
        orderBy: vi.fn(() => ({ all: vi.fn(() => stabilityRows ?? []) })),
      };
    }
    // Beyond pre-set responses: stability query, return chainable
    return { orderBy: vi.fn(() => ({ all: vi.fn(() => stabilityRows ?? []) })) };
  });

  // insert chain: .insert().values().returning().all() for project insert
  //               .insert().values().run() for captureRun insert
  let insertCallCount = 0;
  mockDb.insert.mockImplementation(() => {
    insertCallCount++;
    return {
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue({
          all: vi.fn(() =>
            insertCallCount === 1
              ? [{ id: PROJECT_ID, name: 'my-project' }]
              : [{ id: CAPTURE_RUN_ID, projectId: PROJECT_ID, status: 'pending' }],
          ),
        }),
        run: vi.fn(),
      }),
    };
  });
}

const DEFAULT_OPTIONS = {
  config: 'sentinel.config.yml',
  commitSha: 'abc123',
  branch: 'main',
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('runCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENTINEL_DIR = '/tmp/sentinel-test';
    vi.mocked(loadConfig).mockResolvedValue(makeConfig() as ReturnType<typeof makeConfig> as any);
  });

  it('Test 1: calls processCaptureLocal with correct data and deps', async () => {
    setupDbMocks({
      existingProject: { id: PROJECT_ID, name: 'my-project' },
      diffReports: [],
    });

    await runCapture(DEFAULT_OPTIONS);

    expect(processCaptureLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        captureRunId: expect.any(String),
        configPath: 'sentinel.config.yml',
      }),
      expect.objectContaining({
        db: mockDb,
        storage: mockStorage,
      }),
    );
  });

  it('Test 2: creates a project row (upsert) and captureRun row before calling processCaptureLocal', async () => {
    setupDbMocks({
      existingProject: null, // triggers project insert
      diffReports: [],
    });

    await runCapture(DEFAULT_OPTIONS);

    // createSqliteDb was called with db path
    expect(createSqliteDb).toHaveBeenCalled();

    // processCaptureLocal was called after DB setup
    expect(processCaptureLocal).toHaveBeenCalledOnce();
  });

  it('Test 3: reads diffReports after pipeline and builds DiffSummary with allPassed, failedCount, diffs', async () => {
    setupDbMocks({
      existingProject: { id: PROJECT_ID, name: 'my-project' },
      diffReports: [
        {
          url: '/home',
          viewport: '1280x720',
          pixelDiffPercent: 50,
          ssimScore: 9800,
          passed: 'true',
          diffStorageKey: 'diff/run1/snap1.png',
        },
      ],
    });

    const summary = await runCapture(DEFAULT_OPTIONS);

    expect(summary).toMatchObject({
      allPassed: expect.any(Boolean),
      failedCount: expect.any(Number),
      runId: expect.any(String),
      diffs: expect.any(Array),
    });
    expect(summary.diffs).toHaveLength(1);
  });

  it('Test 4: returns allPassed=true when all diffs have passed="true"', async () => {
    setupDbMocks({
      existingProject: { id: PROJECT_ID, name: 'my-project' },
      diffReports: [
        {
          url: '/home',
          viewport: '1280x720',
          pixelDiffPercent: 10,
          ssimScore: 9900,
          passed: 'true',
          diffStorageKey: 'diff/r/s1.png',
        },
        {
          url: '/about',
          viewport: '1280x720',
          pixelDiffPercent: 5,
          ssimScore: 9950,
          passed: 'true',
          diffStorageKey: 'diff/r/s2.png',
        },
      ],
    });

    const summary = await runCapture(DEFAULT_OPTIONS);

    expect(summary.allPassed).toBe(true);
    expect(summary.failedCount).toBe(0);
  });

  it('Test 5: returns allPassed=false and correct failedCount when some diffs have passed="false"', async () => {
    setupDbMocks({
      existingProject: { id: PROJECT_ID, name: 'my-project' },
      diffReports: [
        {
          url: '/home',
          viewport: '1280x720',
          pixelDiffPercent: 500,
          ssimScore: 8000,
          passed: 'false',
          diffStorageKey: 'diff/r/s1.png',
        },
        {
          url: '/about',
          viewport: '1280x720',
          pixelDiffPercent: 5,
          ssimScore: 9950,
          passed: 'true',
          diffStorageKey: 'diff/r/s2.png',
        },
      ],
    });

    const summary = await runCapture(DEFAULT_OPTIONS);

    expect(summary.allPassed).toBe(false);
    expect(summary.failedCount).toBe(1);
  });

  it('Test 6: DiffSummary.diffs contains correctly converted basis-point values', async () => {
    setupDbMocks({
      existingProject: { id: PROJECT_ID, name: 'my-project' },
      diffReports: [
        {
          url: '/home',
          viewport: '1280x720',
          pixelDiffPercent: 250,  // 250 basis points = 2.50%
          ssimScore: 9750,         // 9750 / 10000 = 0.975
          passed: 'false',
          diffStorageKey: 'diff/run/snap.png',
        },
        {
          url: '/about',
          viewport: '375x667',
          pixelDiffPercent: 0,
          ssimScore: null,          // null SSIM
          passed: 'true',
          diffStorageKey: 'diff/run/snap2.png',
        },
      ],
    });

    const summary = await runCapture(DEFAULT_OPTIONS);

    expect(summary.diffs[0]).toMatchObject({
      url: '/home',
      viewport: '1280x720',
      pixelDiffPercent: 2.5,
      ssimScore: 0.975,
      passed: false,
      diffS3Key: 'diff/run/snap.png',
    });

    expect(summary.diffs[1]).toMatchObject({
      url: '/about',
      viewport: '375x667',
      pixelDiffPercent: 0,
      ssimScore: null,
      passed: true,
      diffS3Key: 'diff/run/snap2.png',
    });
  });

  // ── Budget evaluation wiring ─────────────────────────────────────────────
  describe('budget evaluation wiring', () => {
    it('populates budgetResults when lighthouse scores exist and thresholds configured', async () => {
      vi.mocked(loadConfig).mockResolvedValue(makeConfig({
        performance: { enabled: true, thresholds: { performance: 80 } },
      }) as any);

      setupDbMocks({
        existingProject: { id: PROJECT_ID, name: 'my-project' },
        diffReports: [
          { url: '/home', viewport: '1280x720', pixelDiffPercent: 0, ssimScore: 10000, passed: 'true', diffStorageKey: 'diff/r/s1.png' },
        ],
        lighthouseScoreRows: [
          { url: '/home', performance: 90, accessibility: 85, bestPractices: 80, seo: 95 },
        ],
      });

      const summary = await runCapture(DEFAULT_OPTIONS);

      expect(summary.budgetResults).toBeDefined();
      expect(summary.budgetResults!.length).toBeGreaterThan(0);
      expect(summary.budgetResults![0]).toMatchObject({
        url: '/home',
        category: 'performance',
        score: 90,
        budget: 80,
        passed: true,
      });
    });

    it('budgetsAllPassed=true when all scores meet thresholds, false when any below', async () => {
      vi.mocked(loadConfig).mockResolvedValue(makeConfig({
        performance: { enabled: true, thresholds: { performance: 95 } },
      }) as any);

      setupDbMocks({
        existingProject: { id: PROJECT_ID, name: 'my-project' },
        diffReports: [
          { url: '/home', viewport: '1280x720', pixelDiffPercent: 0, ssimScore: 10000, passed: 'true', diffStorageKey: 'diff/r/s1.png' },
        ],
        lighthouseScoreRows: [
          { url: '/home', performance: 90, accessibility: 85, bestPractices: 80, seo: 95 },
        ],
      });

      const summary = await runCapture(DEFAULT_OPTIONS);

      // performance: 90 < 95 threshold -> failed
      expect(summary.budgetsAllPassed).toBe(false);
    });

    it('per-route budget overrides take priority over global thresholds', async () => {
      vi.mocked(loadConfig).mockResolvedValue(makeConfig({
        performance: {
          enabled: true,
          thresholds: { performance: 80 },
          budgets: [{ route: '/home', performance: 95 }],
        },
      }) as any);

      setupDbMocks({
        existingProject: { id: PROJECT_ID, name: 'my-project' },
        diffReports: [
          { url: '/home', viewport: '1280x720', pixelDiffPercent: 0, ssimScore: 10000, passed: 'true', diffStorageKey: 'diff/r/s1.png' },
        ],
        lighthouseScoreRows: [
          { url: '/home', performance: 90, accessibility: 85, bestPractices: 80, seo: 95 },
        ],
      });

      const summary = await runCapture(DEFAULT_OPTIONS);

      // /home has route override performance: 95, score is 90 -> failed
      const perfResult = summary.budgetResults?.find(r => r.category === 'performance');
      expect(perfResult).toBeDefined();
      expect(perfResult!.budget).toBe(95);
      expect(perfResult!.passed).toBe(false);
    });

    it('budgetResults is undefined when no lighthouse scores exist', async () => {
      vi.mocked(loadConfig).mockResolvedValue(makeConfig({
        performance: { enabled: true, thresholds: { performance: 80 } },
      }) as any);

      setupDbMocks({
        existingProject: { id: PROJECT_ID, name: 'my-project' },
        diffReports: [
          { url: '/home', viewport: '1280x720', pixelDiffPercent: 0, ssimScore: 10000, passed: 'true', diffStorageKey: 'diff/r/s1.png' },
        ],
        lighthouseScoreRows: [], // no lighthouse data
      });

      const summary = await runCapture(DEFAULT_OPTIONS);

      expect(summary.budgetResults).toBeUndefined();
      expect(summary.budgetsAllPassed).toBeUndefined();
    });
  });

  // ── Flaky route detection wiring ─────────────────────────────────────────
  describe('flaky route detection wiring', () => {
    it('populates flakyRoutes for unstable failed routes', async () => {
      setupDbMocks({
        existingProject: { id: PROJECT_ID, name: 'my-project' },
        diffReports: [
          { url: '/home', viewport: '1280x720', pixelDiffPercent: 500, ssimScore: 8000, passed: 'false', diffStorageKey: 'diff/r/s1.png' },
        ],
        stabilityRows: [
          // Alternating pass/fail = flips -> unstable
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'true', createdAt: new Date('2026-02-15') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-02-16') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'true', createdAt: new Date('2026-02-17') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-02-18') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'true', createdAt: new Date('2026-02-19') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-02-20') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'true', createdAt: new Date('2026-02-21') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-02-22') },
        ],
      });

      const summary = await runCapture(DEFAULT_OPTIONS);

      expect(summary.flakyRoutes).toBeDefined();
      expect(summary.flakyRoutes!.length).toBe(1);
      expect(summary.flakyRoutes![0]).toMatchObject({
        url: '/home',
        viewport: '1280x720',
        browser: 'chromium',
      });
      expect(summary.flakyRoutes![0].flipCount).toBeGreaterThan(0);
      expect(summary.flakyRoutes![0].stabilityScore).toBeLessThan(70);
    });

    it('genuineFailureCount = total failures minus flaky, flakyFailureCount = flaky count', async () => {
      setupDbMocks({
        existingProject: { id: PROJECT_ID, name: 'my-project' },
        diffReports: [
          { url: '/home', viewport: '1280x720', pixelDiffPercent: 500, ssimScore: 8000, passed: 'false', diffStorageKey: 'diff/r/s1.png' },
          { url: '/about', viewport: '1280x720', pixelDiffPercent: 300, ssimScore: 9000, passed: 'false', diffStorageKey: 'diff/r/s2.png' },
        ],
        stabilityRows: [
          // /home is flaky (7 flips)
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'true', createdAt: new Date('2026-02-15') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-02-16') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'true', createdAt: new Date('2026-02-17') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-02-18') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'true', createdAt: new Date('2026-02-19') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-02-20') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'true', createdAt: new Date('2026-02-21') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-02-22') },
          // /about is stable (no flips - always fail)
          { url: '/about', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-02-15') },
          { url: '/about', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-02-16') },
        ],
      });

      const summary = await runCapture(DEFAULT_OPTIONS);

      // /home is flaky (7 flips -> score 30 < 70 threshold)
      // /about is stable (0 flips -> score 100 >= 70 threshold)
      expect(summary.flakyFailureCount).toBe(1);
      expect(summary.genuineFailureCount).toBe(1);
    });

    it('flakyRoutes is undefined when all diffs pass', async () => {
      setupDbMocks({
        existingProject: { id: PROJECT_ID, name: 'my-project' },
        diffReports: [
          { url: '/home', viewport: '1280x720', pixelDiffPercent: 0, ssimScore: 10000, passed: 'true', diffStorageKey: 'diff/r/s1.png' },
        ],
      });

      const summary = await runCapture(DEFAULT_OPTIONS);

      expect(summary.flakyRoutes).toBeUndefined();
      expect(summary.genuineFailureCount).toBeUndefined();
      expect(summary.flakyFailureCount).toBeUndefined();
    });

    it('flakyRoutes is empty array when failed diffs exist but all have stable scores', async () => {
      setupDbMocks({
        existingProject: { id: PROJECT_ID, name: 'my-project' },
        diffReports: [
          { url: '/home', viewport: '1280x720', pixelDiffPercent: 500, ssimScore: 8000, passed: 'false', diffStorageKey: 'diff/r/s1.png' },
        ],
        stabilityRows: [
          // Stable: consistently failing (0 flips -> score 100)
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-02-15') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-02-16') },
          { url: '/home', viewport: '1280x720', browser: 'chromium', parameterName: '', passed: 'false', createdAt: new Date('2026-02-17') },
        ],
      });

      const summary = await runCapture(DEFAULT_OPTIONS);

      expect(summary.flakyRoutes).toEqual([]);
      expect(summary.flakyFailureCount).toBe(0);
      expect(summary.genuineFailureCount).toBe(1);
    });
  });
});
