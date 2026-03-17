import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentinel-vrt/db', () => ({
  createDb: vi.fn(() => ({})),
  components: {
    id: 'components.id',
    projectId: 'components.projectId',
    name: 'components.name',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
}));

import { listComponents } from './component-service.js';

// ---------- Chainable mock DB ----------
function buildMockDb(selectResponses: unknown[][] = []) {
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

  return {
    select: vi.fn((..._args: unknown[]) => {
      const response = selectResponses[selectCallIdx] ?? [];
      selectCallIdx++;
      return makeSelectChain(response);
    }),
  };
}

const PROJECT_ID = '00000000-0000-4000-a000-000000000100';

describe('component-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listComponents', () => {
    it('returns all components for a project', async () => {
      const components = [
        { id: 'comp-1', projectId: PROJECT_ID, name: 'Header' },
        { id: 'comp-2', projectId: PROJECT_ID, name: 'Footer' },
      ];
      const db = buildMockDb([components]);
      const result = await listComponents(db as any, PROJECT_ID);

      expect(result).toEqual(components);
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no components exist', async () => {
      const db = buildMockDb([[]]);
      const result = await listComponents(db as any, PROJECT_ID);

      expect(result).toEqual([]);
    });

    it('filters by projectId using eq', async () => {
      const { eq } = await import('drizzle-orm');
      const db = buildMockDb([[]]);
      await listComponents(db as any, PROJECT_ID);

      expect(eq).toHaveBeenCalledWith('components.projectId', PROJECT_ID);
    });
  });
});
