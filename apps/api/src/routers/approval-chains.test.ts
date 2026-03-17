import { describe, it, expect, vi, beforeEach } from 'vitest';

const PROJECT_ID = '00000000-0000-4000-a000-000000000600';
const DIFF_ID = '00000000-0000-4000-a000-000000000601';
const STEP_ID_1 = '00000000-0000-4000-a000-000000000610';
const STEP_ID_2 = '00000000-0000-4000-a000-000000000611';

// ---------- Chainable mock DB ----------
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

  const makeDeleteChain = () => {
    const chain: Record<string, any> = {};
    chain.where = vi.fn(() => chain);
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(undefined).then(fn);
    return chain;
  };

  const makeInsertChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.values = vi.fn(() => chain);
    chain.returning = vi.fn(() => chain);
    chain.onConflictDoNothing = vi.fn(() => chain);
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
    delete: vi.fn(() => makeDeleteChain()),
    transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => {
      // Run the callback with a mock tx that mirrors the db
      const tx: Record<string, any> = {
        select: db.select,
        insert: db.insert,
        delete: db.delete,
      };
      await fn(tx);
    }),
  };

  return db;
}

vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => ({})),
  approvalChainSteps: {
    id: 'approvalChainSteps.id',
    projectId: 'approvalChainSteps.projectId',
    stepOrder: 'approvalChainSteps.stepOrder',
    label: 'approvalChainSteps.label',
    requiredRole: 'approvalChainSteps.requiredRole',
    requiredUserId: 'approvalChainSteps.requiredUserId',
    createdAt: 'approvalChainSteps.createdAt',
  },
  approvalChainProgress: {
    id: 'approvalChainProgress.id',
    diffReportId: 'approvalChainProgress.diffReportId',
    stepId: 'approvalChainProgress.stepId',
    stepOrder: 'approvalChainProgress.stepOrder',
    userId: 'approvalChainProgress.userId',
    userEmail: 'approvalChainProgress.userEmail',
    completedAt: 'approvalChainProgress.completedAt',
  },
  baselines: {
    id: 'baselines.id',
    projectId: 'baselines.projectId',
    url: 'baselines.url',
    viewport: 'baselines.viewport',
    browser: 'baselines.browser',
    parameterName: 'baselines.parameterName',
    s3Key: 'baselines.s3Key',
    snapshotId: 'baselines.snapshotId',
    approvedBy: 'baselines.approvedBy',
    createdAt: 'baselines.createdAt',
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
    projectId: 'captureRuns.projectId',
  },
  projects: {
    id: 'projects.id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  asc: vi.fn((...args: unknown[]) => ({ op: 'asc', args })),
}));

import { upsertChainHandler, getChainHandler, getProgressHandler } from './approval-chains.js';

describe('approvalChainsRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upsertChain', () => {
    it('deletes existing steps and inserts new ones atomically', async () => {
      const db = buildMockDb();
      const steps = [
        { stepOrder: 1, label: 'Design Review', requiredRole: 'org:admin', requiredUserId: null },
        { stepOrder: 2, label: 'QA Review', requiredRole: null, requiredUserId: null },
      ];

      const result = await upsertChainHandler(db as any, PROJECT_ID, steps);
      expect(result).toEqual({ count: 2 });
      expect(db.transaction).toHaveBeenCalled();
    });
  });

  describe('getChain', () => {
    it('returns ordered steps for a project', async () => {
      const steps = [
        { id: STEP_ID_1, projectId: PROJECT_ID, stepOrder: 1, label: 'Design Lead', requiredRole: 'org:admin', requiredUserId: null },
        { id: STEP_ID_2, projectId: PROJECT_ID, stepOrder: 2, label: 'QA', requiredRole: null, requiredUserId: null },
      ];
      const db = buildMockDb([steps]);

      const result = await getChainHandler(db as any, PROJECT_ID);
      expect(result).toEqual(steps);
    });
  });

  describe('getProgress', () => {
    it('returns completed steps and current step for a diff', async () => {
      const steps = [
        { id: STEP_ID_1, projectId: PROJECT_ID, stepOrder: 1, label: 'Design Lead', requiredRole: 'org:admin', requiredUserId: null },
        { id: STEP_ID_2, projectId: PROJECT_ID, stepOrder: 2, label: 'QA', requiredRole: null, requiredUserId: null },
      ];
      const diffRow = [{ projectId: PROJECT_ID }];
      const progress = [{ stepOrder: 1, userId: 'user-1', userEmail: 'u@t.com', completedAt: new Date() }];
      // select calls: 1) diff lookup, 2) chain steps, 3) progress,
      // 4+5) getCurrentStep (chain + progress), 6+7) isChainComplete (chain + progress)
      const db = buildMockDb([diffRow, steps, progress, steps, progress, steps, progress]);

      const result = await getProgressHandler(db as any, DIFF_ID);
      expect(result.chain).toEqual(steps);
      expect(result.completed).toEqual(progress);
      expect(result.currentStep).toEqual(steps[1]); // second step is current
      expect(result.isComplete).toBe(false);
    });
  });
});
