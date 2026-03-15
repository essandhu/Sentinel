import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Chainable mock DB ----------
function buildMockDb(selectResponses: unknown[][] = [], insertResult?: unknown[], updateResult?: unknown[], deleteResult?: unknown[]) {
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

  const makeUpdateChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(() => chain);
    chain.then = (fn: (v: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(fn);
    return chain;
  };

  const makeDeleteChain = (resolveValue: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.where = vi.fn(() => chain);
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
    update: vi.fn(() => makeUpdateChain(updateResult ?? [])),
    delete: vi.fn(() => makeDeleteChain(deleteResult ?? [])),
  };
}

vi.mock('@sentinel/db', () => ({
  createDb: vi.fn(() => ({})),
  environments: {
    id: 'environments.id',
    projectId: 'environments.projectId',
    name: 'environments.name',
    baseUrl: 'environments.baseUrl',
    isReference: 'environments.isReference',
    createdAt: 'environments.createdAt',
    updatedAt: 'environments.updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  ne: vi.fn((...args: unknown[]) => ({ op: 'ne', args })),
  asc: vi.fn((...args: unknown[]) => ({ op: 'asc', args })),
}));

import {
  listEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
} from './environment-service.js';

const PROJECT_ID = '00000000-0000-4000-a000-000000000600';
const ENV_ID = '00000000-0000-4000-a000-000000000601';

describe('environment-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listEnvironments', () => {
    it('returns all environments for a project', async () => {
      const envs = [
        { id: ENV_ID, projectId: PROJECT_ID, name: 'dev', baseUrl: null, isReference: 0 },
        { id: '00000000-0000-4000-a000-000000000602', projectId: PROJECT_ID, name: 'production', baseUrl: 'https://prod.example.com', isReference: 1 },
      ];
      const db = buildMockDb([envs]);
      const result = await listEnvironments(db as any, PROJECT_ID);
      expect(result).toEqual(envs);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('createEnvironment', () => {
    it('inserts with normalized lowercase name', async () => {
      const created = [{ id: ENV_ID, projectId: PROJECT_ID, name: 'staging', baseUrl: null, isReference: 0 }];
      const db = buildMockDb([], created);
      const result = await createEnvironment(db as any, {
        projectId: PROJECT_ID,
        name: '  Staging  ',
      });
      expect(result).toEqual(created);
      expect(db.insert).toHaveBeenCalled();
      const insertChain = (db.insert as any).mock.results[0].value;
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'staging' }),
      );
    });

    it('rejects invalid name format', async () => {
      const db = buildMockDb();
      await expect(
        createEnvironment(db as any, { projectId: PROJECT_ID, name: 'invalid name!' }),
      ).rejects.toThrow(/alphanumeric/i);
    });

    it('rejects empty name', async () => {
      const db = buildMockDb();
      await expect(
        createEnvironment(db as any, { projectId: PROJECT_ID, name: '   ' }),
      ).rejects.toThrow();
    });

    it('clears isReference on other envs when setting isReference true', async () => {
      const created = [{ id: ENV_ID, projectId: PROJECT_ID, name: 'production', baseUrl: null, isReference: 1 }];
      const db = buildMockDb([], created);
      await createEnvironment(db as any, {
        projectId: PROJECT_ID,
        name: 'production',
        isReference: true,
      });
      // update should have been called to clear other isReference flags
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('updateEnvironment', () => {
    it('updates baseUrl and isReference', async () => {
      const updated = [{ id: ENV_ID, projectId: PROJECT_ID, name: 'dev', baseUrl: 'https://dev.example.com', isReference: 1 }];
      // First select to get the env (need projectId for isReference clearing)
      const existingEnv = [{ id: ENV_ID, projectId: PROJECT_ID, name: 'dev', baseUrl: null, isReference: 0 }];
      const db = buildMockDb([existingEnv], undefined, updated);
      await updateEnvironment(db as any, {
        id: ENV_ID,
        baseUrl: 'https://dev.example.com',
        isReference: true,
      });
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('deleteEnvironment', () => {
    it('removes the environment', async () => {
      const db = buildMockDb([], undefined, undefined, [{ id: ENV_ID }]);
      await deleteEnvironment(db as any, ENV_ID);
      expect(db.delete).toHaveBeenCalled();
    });
  });
});
