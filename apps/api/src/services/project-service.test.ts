import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listProjects, getProjectById } from './project-service.js';

// Lightweight mock for Drizzle's chainable query builder
function createMockDb(rows: unknown[] = []) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  return chain;
}

describe('project-service', () => {
  describe('listProjects', () => {
    it('returns rows filtered by workspaceId', async () => {
      const fakeRows = [
        { id: 'p1', name: 'Project 1', createdAt: new Date() },
        { id: 'p2', name: 'Project 2', createdAt: new Date() },
      ];
      const db = createMockDb(fakeRows);

      const result = await listProjects(db, 'ws-1');

      expect(result).toEqual(fakeRows);
      expect(db.select).toHaveBeenCalledTimes(1);
      expect(db.from).toHaveBeenCalledTimes(1);
      expect(db.where).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no projects exist', async () => {
      const db = createMockDb([]);

      const result = await listProjects(db, 'ws-empty');

      expect(result).toEqual([]);
    });
  });

  describe('getProjectById', () => {
    it('returns project when found', async () => {
      const fakeProject = { id: 'p1', name: 'My Project', createdAt: new Date() };
      const db = createMockDb([fakeProject]);

      const result = await getProjectById(db, 'p1', 'ws-1');

      expect(result).toEqual(fakeProject);
    });

    it('returns null when project not found', async () => {
      const db = createMockDb([]);

      const result = await getProjectById(db, 'nonexistent', 'ws-1');

      expect(result).toBeNull();
    });

    it('works without workspaceId parameter', async () => {
      const fakeProject = { id: 'p1', name: 'My Project', createdAt: new Date() };
      const db = createMockDb([fakeProject]);

      const result = await getProjectById(db, 'p1');

      expect(result).toEqual(fakeProject);
      expect(db.where).toHaveBeenCalledTimes(1);
    });
  });
});
