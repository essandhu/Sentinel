import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Chainable mock DB ----------
function buildMockDb(selectResponses: unknown[][] = [], insertResult?: unknown[]) {
  let selectCallIdx = 0;

  const makeSelectChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
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
    chain.onConflictDoNothing = vi.fn(() => chain);
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
    insert: vi.fn(() => makeInsertChain(insertResult ?? [])),
  };
}

vi.mock('@sentinel/db', () => ({
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
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  asc: vi.fn((...args: unknown[]) => ({ op: 'asc', args })),
}));

import {
  getChainForProject,
  getCurrentStep,
  isChainComplete,
  canUserCompleteStep,
  maybePromoteBaseline,
  validateAndRecordApproval,
} from './approval-chain-service.js';

const PROJECT_ID = '00000000-0000-4000-a000-000000000500';
const DIFF_ID = '00000000-0000-4000-a000-000000000501';
const STEP_ID_1 = '00000000-0000-4000-a000-000000000510';
const STEP_ID_2 = '00000000-0000-4000-a000-000000000511';

describe('approval-chain-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChainForProject', () => {
    it('returns empty array when no chain defined', async () => {
      const db = buildMockDb([[]]);
      const result = await getChainForProject(db as any, PROJECT_ID);
      expect(result).toEqual([]);
    });

    it('returns steps ordered by stepOrder', async () => {
      const steps = [
        { id: STEP_ID_1, projectId: PROJECT_ID, stepOrder: 1, label: 'Design Lead', requiredRole: 'org:admin', requiredUserId: null },
        { id: STEP_ID_2, projectId: PROJECT_ID, stepOrder: 2, label: 'QA', requiredRole: null, requiredUserId: null },
      ];
      const db = buildMockDb([steps]);
      const result = await getChainForProject(db as any, PROJECT_ID);
      expect(result).toEqual(steps);
      expect(result[0].stepOrder).toBe(1);
      expect(result[1].stepOrder).toBe(2);
    });
  });

  describe('getCurrentStep', () => {
    it('returns null when no chain exists (legacy behavior)', async () => {
      // First select: chain steps = empty
      const db = buildMockDb([[], []]);
      const result = await getCurrentStep(db as any, DIFF_ID, PROJECT_ID);
      expect(result).toBeNull();
    });

    it('returns first incomplete step', async () => {
      const steps = [
        { id: STEP_ID_1, projectId: PROJECT_ID, stepOrder: 1, label: 'Design Lead', requiredRole: 'org:admin', requiredUserId: null },
        { id: STEP_ID_2, projectId: PROJECT_ID, stepOrder: 2, label: 'QA', requiredRole: null, requiredUserId: null },
      ];
      // First select: chain steps, second: completed progress (step 1 done)
      const progress = [{ stepOrder: 1 }];
      const db = buildMockDb([steps, progress]);
      const result = await getCurrentStep(db as any, DIFF_ID, PROJECT_ID);
      expect(result).toEqual(steps[1]);
    });

    it('returns null when all steps complete', async () => {
      const steps = [
        { id: STEP_ID_1, projectId: PROJECT_ID, stepOrder: 1, label: 'Design Lead', requiredRole: 'org:admin', requiredUserId: null },
      ];
      const progress = [{ stepOrder: 1 }];
      const db = buildMockDb([steps, progress]);
      const result = await getCurrentStep(db as any, DIFF_ID, PROJECT_ID);
      expect(result).toBeNull();
    });
  });

  describe('isChainComplete', () => {
    it('returns true when no chain defined (backward compat)', async () => {
      const db = buildMockDb([[], []]);
      const result = await isChainComplete(db as any, DIFF_ID, PROJECT_ID);
      expect(result).toBe(true);
    });

    it('returns false when steps remain', async () => {
      const steps = [
        { id: STEP_ID_1, stepOrder: 1 },
        { id: STEP_ID_2, stepOrder: 2 },
      ];
      const progress = [{ stepOrder: 1 }];
      const db = buildMockDb([steps, progress]);
      const result = await isChainComplete(db as any, DIFF_ID, PROJECT_ID);
      expect(result).toBe(false);
    });

    it('returns true when all steps done', async () => {
      const steps = [
        { id: STEP_ID_1, stepOrder: 1 },
      ];
      const progress = [{ stepOrder: 1 }];
      const db = buildMockDb([steps, progress]);
      const result = await isChainComplete(db as any, DIFF_ID, PROJECT_ID);
      expect(result).toBe(true);
    });
  });

  describe('canUserCompleteStep', () => {
    it('matches by requiredUserId when set', () => {
      const step = { id: STEP_ID_1, requiredRole: null, requiredUserId: 'user-123' };
      expect(canUserCompleteStep(step, 'user-123', 'org:member')).toBe(true);
    });

    it('returns false when requiredUserId does not match', () => {
      const step = { id: STEP_ID_1, requiredRole: null, requiredUserId: 'user-123' };
      expect(canUserCompleteStep(step, 'user-456', 'org:member')).toBe(false);
    });

    it('matches by requiredRole when set', () => {
      const step = { id: STEP_ID_1, requiredRole: 'org:admin', requiredUserId: null };
      expect(canUserCompleteStep(step, 'user-123', 'org:admin')).toBe(true);
    });

    it('returns true when no restriction', () => {
      const step = { id: STEP_ID_1, requiredRole: null, requiredUserId: null };
      expect(canUserCompleteStep(step, 'user-123', 'org:member')).toBe(true);
    });

    it('returns false on role mismatch', () => {
      const step = { id: STEP_ID_1, requiredRole: 'org:admin', requiredUserId: null };
      expect(canUserCompleteStep(step, 'user-123', 'org:member')).toBe(false);
    });
  });

  describe('maybePromoteBaseline', () => {
    it('inserts baseline when chain complete', async () => {
      // isChainComplete path: steps=[1 step], progress=[1 completed]
      const steps = [{ id: STEP_ID_1, stepOrder: 1 }];
      const progress = [{ stepOrder: 1 }];
      const db = buildMockDb([steps, progress]);
      const diffInfo = {
        projectId: PROJECT_ID,
        url: 'https://example.com',
        viewport: '1920x1080',
        browser: 'chromium',
        parameterName: '',
        s3Key: 'screenshots/test.png',
        snapshotId: '00000000-0000-4000-a000-000000000520',
      };

      const result = await maybePromoteBaseline(db as any, DIFF_ID, PROJECT_ID, diffInfo);
      expect(result).toBe(true);
      expect(db.insert).toHaveBeenCalled();
    });

    it('returns false when chain incomplete', async () => {
      const steps = [
        { id: STEP_ID_1, stepOrder: 1 },
        { id: STEP_ID_2, stepOrder: 2 },
      ];
      const progress = [{ stepOrder: 1 }];
      const db = buildMockDb([steps, progress]);
      const diffInfo = {
        projectId: PROJECT_ID,
        url: 'https://example.com',
        viewport: '1920x1080',
        browser: 'chromium',
        parameterName: '',
        s3Key: 'screenshots/test.png',
        snapshotId: '00000000-0000-4000-a000-000000000520',
      };

      const result = await maybePromoteBaseline(db as any, DIFF_ID, PROJECT_ID, diffInfo);
      expect(result).toBe(false);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('inserts baseline preserving non-empty parameterName', async () => {
      // isChainComplete path: steps=[1 step], progress=[1 completed]
      const steps = [{ id: STEP_ID_1, stepOrder: 1 }];
      const progress = [{ stepOrder: 1 }];
      const db = buildMockDb([steps, progress]);
      const diffInfo = {
        projectId: PROJECT_ID,
        url: 'https://example.com',
        viewport: '1920x1080',
        browser: 'chromium',
        parameterName: 'theme:dark|locale:fr',
        s3Key: 'screenshots/test.png',
        snapshotId: '00000000-0000-4000-a000-000000000520',
      };

      const result = await maybePromoteBaseline(db as any, DIFF_ID, PROJECT_ID, diffInfo);
      expect(result).toBe(true);
      expect(db.insert).toHaveBeenCalled();
      // Verify the values() call received the non-empty parameterName
      const insertChain = (db.insert as any).mock.results[0].value;
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ parameterName: 'theme:dark|locale:fr' }),
      );
    });

    it('inserts baseline immediately when no chain exists', async () => {
      const db = buildMockDb([[], []]);
      const diffInfo = {
        projectId: PROJECT_ID,
        url: 'https://example.com',
        viewport: '1920x1080',
        browser: 'chromium',
        parameterName: '',
        s3Key: 'screenshots/test.png',
        snapshotId: '00000000-0000-4000-a000-000000000520',
      };

      const result = await maybePromoteBaseline(db as any, DIFF_ID, PROJECT_ID, diffInfo);
      expect(result).toBe(true);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('validateAndRecordApproval', () => {
    it('rejects out-of-order step attempts', async () => {
      // No chain steps = no current step = nothing to record
      // But let's test when chain exists but user can't complete
      const steps = [
        { id: STEP_ID_1, projectId: PROJECT_ID, stepOrder: 1, label: 'Admin Only', requiredRole: 'org:admin', requiredUserId: null },
      ];
      const progress: unknown[] = [];
      const db = buildMockDb([steps, progress]);

      const result = await validateAndRecordApproval(
        db as any,
        DIFF_ID,
        PROJECT_ID,
        'user-123',
        'user@test.com',
        'org:member', // wrong role
      );
      expect(result.recorded).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
