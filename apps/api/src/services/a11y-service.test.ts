import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Test UUIDs ----------
const RUN_ID = '00000000-0000-4000-a000-000000000100';
const PREV_RUN_ID = '00000000-0000-4000-a000-000000000099';
const PROJ_ID = '00000000-0000-4000-a000-000000000001';

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
    selectDistinct: vi.fn((..._args: unknown[]) => {
      const response = selectResponses[selectCallIdx] ?? [];
      selectCallIdx++;
      return makeSelectChain(response);
    }),
  };

  return db;
}

// Mock @sentinel-vrt/db
vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => ({})),
  a11yViolations: {
    id: 'a11yViolations.id',
    captureRunId: 'a11yViolations.captureRunId',
    projectId: 'a11yViolations.projectId',
    url: 'a11yViolations.url',
    viewport: 'a11yViolations.viewport',
    browser: 'a11yViolations.browser',
    ruleId: 'a11yViolations.ruleId',
    impact: 'a11yViolations.impact',
    fingerprint: 'a11yViolations.fingerprint',
    cssSelector: 'a11yViolations.cssSelector',
    html: 'a11yViolations.html',
    helpUrl: 'a11yViolations.helpUrl',
    isNew: 'a11yViolations.isNew',
    createdAt: 'a11yViolations.createdAt',
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.projectId',
    status: 'captureRuns.status',
    createdAt: 'captureRuns.createdAt',
    completedAt: 'captureRuns.completedAt',
  },
  projects: {
    id: 'projects.id',
    workspaceId: 'projects.workspaceId',
  },
}));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  gte: vi.fn((a, b) => ({ _type: 'gte', a, b })),
  lt: vi.fn((a, b) => ({ _type: 'lt', a, b })),
  ne: vi.fn((a, b) => ({ _type: 'ne', a, b })),
  not: vi.fn((a) => ({ _type: 'not', a })),
  inArray: vi.fn((col, vals) => ({ _type: 'inArray', col, vals })),
  notInArray: vi.fn((col, vals) => ({ _type: 'notInArray', col, vals })),
  isNull: vi.fn((a) => ({ _type: 'isNull', a })),
  isNotNull: vi.fn((a) => ({ _type: 'isNotNull', a })),
  count: vi.fn(() => 'count(*)'),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
    { raw: vi.fn((s: string) => ({ _type: 'sql_raw', s })) },
  ),
}));

import { getViolationsByRunId, getA11ySummaryByProject } from './a11y-service.js';

describe('a11y-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getViolationsByRunId', () => {
    it('returns violations grouped by status with correct summary counts', async () => {
      const db = buildMockDb([
        // Query 0: violations for this run
        [
          { id: 'v1', ruleId: 'color-contrast', impact: 'serious', cssSelector: '.btn', html: '<button>', helpUrl: 'https://axe.com/1', isNew: 1, fingerprint: 'fp1' },
          { id: 'v2', ruleId: 'aria-label', impact: 'critical', cssSelector: '.nav', html: '<nav>', helpUrl: 'https://axe.com/2', isNew: 0, fingerprint: 'fp2' },
          { id: 'v3', ruleId: 'alt-text', impact: 'moderate', cssSelector: 'img', html: '<img>', helpUrl: 'https://axe.com/3', isNew: 1, fingerprint: 'fp3' },
        ],
        // Query 1: capture run (to get projectId)
        [{ projectId: PROJ_ID }],
        // Query 2: previous run for this project
        [{ id: PREV_RUN_ID }],
        // Query 3: previous run's fingerprints
        [{ fingerprint: 'fp2' }, { fingerprint: 'fp4' }, { fingerprint: 'fp5' }],
      ]);

      const result = await getViolationsByRunId(db as any, RUN_ID);

      expect(result.summary.new).toBe(2);       // fp1, fp3 (isNew=1)
      expect(result.summary.existing).toBe(1);   // fp2 (isNew=0)
      expect(result.summary.fixed).toBe(2);      // fp4, fp5 (in prev but not current)
      expect(result.violations).toHaveLength(3);
    });

    it('returns zero fixed when no previous run exists', async () => {
      const db = buildMockDb([
        // Query 0: violations for this run
        [
          { id: 'v1', ruleId: 'color-contrast', impact: 'serious', cssSelector: '.btn', html: '<button>', helpUrl: 'https://axe.com/1', isNew: 1, fingerprint: 'fp1' },
        ],
        // Query 1: capture run (to get projectId)
        [{ projectId: PROJ_ID }],
        // Query 2: no previous run
        [],
      ]);

      const result = await getViolationsByRunId(db as any, RUN_ID);

      expect(result.summary.new).toBe(1);
      expect(result.summary.existing).toBe(0);
      expect(result.summary.fixed).toBe(0);
      expect(result.violations).toHaveLength(1);
    });

    it('returns empty when no violations for run', async () => {
      const db = buildMockDb([
        // Query 0: no violations
        [],
        // Query 1: capture run
        [{ projectId: PROJ_ID }],
        // Query 2: no previous run
        [],
      ]);

      const result = await getViolationsByRunId(db as any, RUN_ID);

      expect(result.summary.new).toBe(0);
      expect(result.summary.existing).toBe(0);
      expect(result.summary.fixed).toBe(0);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('getA11ySummaryByProject', () => {
    it('returns total and new violation counts from most recent run', async () => {
      const db = buildMockDb([
        // Query 0: most recent capture run with a11y data
        [{ id: RUN_ID }],
        // Query 1: violations from that run
        [
          { id: 'v1', isNew: 1 },
          { id: 'v2', isNew: 0 },
          { id: 'v3', isNew: 1 },
        ],
      ]);

      const result = await getA11ySummaryByProject(db as any, PROJ_ID);

      expect(result.totalViolations).toBe(3);
      expect(result.newCount).toBe(2);
      expect(result.latestRunId).toBe(RUN_ID);
    });

    it('returns zeros when no a11y data exists for project', async () => {
      const db = buildMockDb([
        // Query 0: no capture runs with a11y data
        [],
      ]);

      const result = await getA11ySummaryByProject(db as any, PROJ_ID);

      expect(result.totalViolations).toBe(0);
      expect(result.newCount).toBe(0);
      expect(result.latestRunId).toBeNull();
    });
  });
});
