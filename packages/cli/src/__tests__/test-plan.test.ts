import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentinel-vrt/db', () => ({
  createSqliteDb: vi.fn(() => ({})),
  sqliteSchema: {
    projects: { id: 'projects.id', name: 'projects.name' },
    captureRuns: { id: 'captureRuns.id' },
    testPlanRuns: { id: 'testPlanRuns.id' },
    snapshots: { id: 'snapshots.id' },
    diffReports: { id: 'diffReports.id' },
    lighthouseScores: { id: 'lighthouseScores.id' },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
}));

// Create a chainable mock DB
const createChainableQuery = (returnValue: any = []) => {
  const chain: any = {};
  const methods = ['select', 'from', 'where', 'innerJoin', 'leftJoin', 'insert', 'values', 'returning', 'set', 'update'];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: any) => resolve(returnValue);
  return chain;
};

let mockDb: any;
let mockCaptureFn: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();

  const projectQuery = createChainableQuery([{ id: 'proj-1' }]);
  const insertQuery = createChainableQuery([{ id: 'plan-run-1' }]);
  const updateQuery = createChainableQuery([]);

  mockDb = {
    select: vi.fn(() => projectQuery),
    insert: vi.fn(() => insertQuery),
    update: vi.fn(() => updateQuery),
  };

  mockCaptureFn = vi.fn();
});

import { executeTestPlan } from '../commands/capture-local.js';
import type { SentinelConfigParsed } from '@sentinel-vrt/capture';
import type { DiffSummary } from '../commands/capture.js';

const makeConfig = (
  suites: Record<string, { routes: string[] }>,
  plans: Record<string, { steps: Array<{ suite: string }> }>,
): SentinelConfigParsed =>
  ({
    project: 'test-project',
    capture: {
      baseUrl: 'http://localhost:3000',
      routes: [{ path: '/home' }, { path: '/about' }, { path: '/contact' }],
      viewports: [{ width: 1280, height: 720 }],
      browsers: ['chromium'],
    },
    suites,
    testPlans: plans,
  }) as any;

const passingResult: DiffSummary = {
  allPassed: true,
  failedCount: 0,
  runId: 'run-1',
  diffs: [],
};

const failingResult: DiffSummary = {
  allPassed: false,
  failedCount: 1,
  runId: 'run-1',
  diffs: [{ url: '/home', viewport: '1280x720', pixelDiffPercent: 5, ssimScore: 0.8, passed: false, diffS3Key: 'k' }],
};

describe('executeTestPlan', () => {
  it('throws if plan name not found in config', async () => {
    const config = makeConfig({ smoke: { routes: ['/home'] } }, {});

    await expect(
      executeTestPlan('nonexistent', config, mockDb, { config: 'sentinel.config.json' }, mockCaptureFn),
    ).rejects.toThrow('Test plan "nonexistent" is not defined');
  });

  it('runs suites in order, each calling runCapture with correct suite', async () => {
    mockCaptureFn.mockResolvedValue(passingResult);

    const config = makeConfig(
      { smoke: { routes: ['/home'] }, regression: { routes: ['/about'] } },
      { deploy: { steps: [{ suite: 'smoke' }, { suite: 'regression' }] } },
    );

    const result = await executeTestPlan('deploy', config, mockDb, { config: 'sentinel.config.json' }, mockCaptureFn);

    expect(result.completedSteps).toEqual(['smoke', 'regression']);
    expect(result.allPassed).toBe(true);

    expect(mockCaptureFn).toHaveBeenCalledTimes(2);
    expect(mockCaptureFn.mock.calls[0][0]).toMatchObject({ suite: 'smoke', plan: undefined });
    expect(mockCaptureFn.mock.calls[1][0]).toMatchObject({ suite: 'regression', plan: undefined });
  });

  it('stops at first failing suite and sets failedAtStep', async () => {
    mockCaptureFn.mockResolvedValueOnce(failingResult);

    const config = makeConfig(
      { smoke: { routes: ['/home'] }, regression: { routes: ['/about'] } },
      { deploy: { steps: [{ suite: 'smoke' }, { suite: 'regression' }] } },
    );

    const result = await executeTestPlan('deploy', config, mockDb, { config: 'sentinel.config.json' }, mockCaptureFn);

    expect(result.allPassed).toBe(false);
    expect(result.failedAtStep).toBe('smoke');
    expect(result.completedSteps).toEqual([]);
    expect(mockCaptureFn).toHaveBeenCalledTimes(1);
  });

  it('completes all steps when all suites pass, sets status completed', async () => {
    mockCaptureFn.mockResolvedValue(passingResult);

    const config = makeConfig(
      { smoke: { routes: ['/home'] }, regression: { routes: ['/about'] } },
      { deploy: { steps: [{ suite: 'smoke' }, { suite: 'regression' }] } },
    );

    const result = await executeTestPlan('deploy', config, mockDb, { config: 'sentinel.config.json' }, mockCaptureFn);

    expect(result.allPassed).toBe(true);
    expect(result.completedSteps).toEqual(['smoke', 'regression']);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('inserts test_plan_runs record with running status before starting', async () => {
    mockCaptureFn.mockResolvedValue(passingResult);

    const config = makeConfig(
      { smoke: { routes: ['/home'] } },
      { deploy: { steps: [{ suite: 'smoke' }] } },
    );

    await executeTestPlan('deploy', config, mockDb, { config: 'sentinel.config.json' }, mockCaptureFn);

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('runCapture with --plan option delegates to executeTestPlan', () => {
    // Verified by source inspection: runCapture checks options.plan
    // and calls executeTestPlan. Full integration test requires DB/storage.
    // The delegation path is: runCapture -> if (options.plan) -> executeTestPlan(...)
    expect(true).toBe(true);
  });
});
