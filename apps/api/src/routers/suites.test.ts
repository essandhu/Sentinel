import { describe, it, expect, vi, beforeEach } from 'vitest';

const PROJECT_ID = '00000000-0000-4000-a000-000000000300';
const SUITE_ID = '00000000-0000-4000-a000-000000000301';

// ---------- Chainable mock DB ----------
function buildMockDb(selectResponses: unknown[][] = [], insertResult?: unknown[]) {
  let selectCallIdx = 0;

  const makeSelectChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
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
    insert: vi.fn(() => makeInsertChain(insertResult ?? [])),
  };
}

vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => ({})),
  testSuites: {
    id: 'testSuites.id',
    projectId: 'testSuites.projectId',
    name: 'testSuites.name',
    createdAt: 'testSuites.createdAt',
    updatedAt: 'testSuites.updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

import { listHandler, upsertHandler } from './suites.js';

describe('suitesRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('returns suites for a project', async () => {
      const suites = [
        { id: SUITE_ID, projectId: PROJECT_ID, name: 'smoke', createdAt: new Date(), updatedAt: new Date() },
      ];
      const db = buildMockDb([suites]);

      const result = await listHandler(db as any, PROJECT_ID);
      expect(result).toEqual(suites);
      expect(db.select).toHaveBeenCalled();
    });

    it('returns empty array when no suites exist', async () => {
      const db = buildMockDb([[]]);
      const result = await listHandler(db as any, PROJECT_ID);
      expect(result).toEqual([]);
    });
  });

  describe('upsert', () => {
    it('returns existing suite if already exists', async () => {
      const existing = { id: SUITE_ID, projectId: PROJECT_ID, name: 'smoke', createdAt: new Date(), updatedAt: new Date() };
      const db = buildMockDb([[existing]]);

      const result = await upsertHandler(db as any, PROJECT_ID, 'smoke');
      expect(result).toEqual(existing);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('creates new suite when not found', async () => {
      const inserted = { id: SUITE_ID, projectId: PROJECT_ID, name: 'regression', createdAt: new Date(), updatedAt: new Date() };
      const db = buildMockDb([[]], [inserted]);

      const result = await upsertHandler(db as any, PROJECT_ID, 'regression');
      expect(result).toEqual(inserted);
      expect(db.insert).toHaveBeenCalled();
    });
  });
});
