import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectNextProject, extractNextRoutes } from './next-extractor.js';

vi.mock('node:fs/promises');

import { readFile, readdir, access } from 'node:fs/promises';

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockAccess = vi.mocked(access);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('detectNextProject', () => {
  it('returns true when next is in dependencies', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ dependencies: { next: '^14.0.0' } }),
    );

    expect(await detectNextProject('/project')).toBe(true);
    expect(mockReadFile).toHaveBeenCalledWith(join('/project', 'package.json'), 'utf-8');
  });

  it('returns true when next is in devDependencies', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ devDependencies: { next: '^14.0.0' } }),
    );

    expect(await detectNextProject('/project')).toBe(true);
  });

  it('returns false when next is not in any dependencies', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ dependencies: { react: '^18.0.0' } }),
    );

    expect(await detectNextProject('/project')).toBe(false);
  });

  it('returns false when package.json does not exist', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    expect(await detectNextProject('/project')).toBe(false);
  });
});

describe('extractNextRoutes', () => {
  describe('App Router', () => {
    it('finds page.tsx files and converts to routes', async () => {
      mockAccess.mockImplementation(async (path) => {
        if (String(path).includes('app')) return undefined;
        throw new Error('ENOENT');
      });

      mockReaddir.mockResolvedValue([
        { name: 'page.tsx', isDirectory: () => false, isFile: () => true },
        { name: 'about', isDirectory: () => true, isFile: () => false },
        { name: 'layout.tsx', isDirectory: () => false, isFile: () => true },
      ] as any);

      // Override readdir for subdirectory
      mockReaddir
        .mockResolvedValueOnce([
          { name: 'page.tsx', isDirectory: () => false, isFile: () => true },
          { name: 'about', isDirectory: () => true, isFile: () => false },
          { name: 'layout.tsx', isDirectory: () => false, isFile: () => true },
        ] as any)
        .mockResolvedValueOnce([
          { name: 'page.tsx', isDirectory: () => false, isFile: () => true },
        ] as any);

      const routes = await extractNextRoutes('/project');

      expect(routes).toContainEqual({
        path: '/',
        name: 'home',
        source: 'framework',
      });
      expect(routes).toContainEqual({
        path: '/about',
        name: 'about',
        source: 'framework',
      });
      // layout.tsx should not appear as a route
      expect(routes.find((r) => r.name === 'layout')).toBeUndefined();
    });

    it('skips dynamic [id] segments', async () => {
      mockAccess.mockImplementation(async (path) => {
        if (String(path).includes('app')) return undefined;
        throw new Error('ENOENT');
      });

      mockReaddir
        .mockResolvedValueOnce([
          { name: 'page.tsx', isDirectory: () => false, isFile: () => true },
          { name: '[id]', isDirectory: () => true, isFile: () => false },
          { name: 'about', isDirectory: () => true, isFile: () => false },
        ] as any)
        .mockResolvedValueOnce([
          { name: 'page.tsx', isDirectory: () => false, isFile: () => true },
        ] as any);

      const routes = await extractNextRoutes('/project');

      expect(routes).toHaveLength(2);
      expect(routes.map((r) => r.path)).toContain('/');
      expect(routes.map((r) => r.path)).toContain('/about');
      // No dynamic routes
      expect(routes.find((r) => r.path.includes('['))).toBeUndefined();
    });

    it('skips (group) route groups', async () => {
      mockAccess.mockImplementation(async (path) => {
        if (String(path).includes('app')) return undefined;
        throw new Error('ENOENT');
      });

      mockReaddir.mockResolvedValueOnce([
        { name: '(marketing)', isDirectory: () => true, isFile: () => false },
        { name: 'page.tsx', isDirectory: () => false, isFile: () => true },
      ] as any);

      const routes = await extractNextRoutes('/project');

      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/');
    });

    it('skips layout.tsx and other special files', async () => {
      mockAccess.mockImplementation(async (path) => {
        if (String(path).includes('app')) return undefined;
        throw new Error('ENOENT');
      });

      mockReaddir.mockResolvedValueOnce([
        { name: 'page.tsx', isDirectory: () => false, isFile: () => true },
        { name: 'layout.tsx', isDirectory: () => false, isFile: () => true },
        { name: 'loading.tsx', isDirectory: () => false, isFile: () => true },
        { name: 'error.tsx', isDirectory: () => false, isFile: () => true },
        { name: 'not-found.tsx', isDirectory: () => false, isFile: () => true },
      ] as any);

      const routes = await extractNextRoutes('/project');

      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/');
    });
  });

  describe('Pages Router', () => {
    it('finds index.tsx and named .tsx files', async () => {
      // app/ doesn't exist, pages/ does
      mockAccess.mockImplementation(async (path) => {
        if (String(path).includes('pages')) return undefined;
        throw new Error('ENOENT');
      });

      mockReaddir
        .mockResolvedValueOnce([
          { name: 'index.tsx', isDirectory: () => false, isFile: () => true },
          { name: 'about.tsx', isDirectory: () => false, isFile: () => true },
          { name: '_app.tsx', isDirectory: () => false, isFile: () => true },
          { name: 'blog', isDirectory: () => true, isFile: () => false },
        ] as any)
        .mockResolvedValueOnce([
          { name: 'index.tsx', isDirectory: () => false, isFile: () => true },
          { name: 'posts.tsx', isDirectory: () => false, isFile: () => true },
        ] as any);

      const routes = await extractNextRoutes('/project');

      expect(routes).toContainEqual({
        path: '/',
        name: 'home',
        source: 'framework',
      });
      expect(routes).toContainEqual({
        path: '/about',
        name: 'about',
        source: 'framework',
      });
      expect(routes).toContainEqual({
        path: '/blog',
        name: 'blog',
        source: 'framework',
      });
      expect(routes).toContainEqual({
        path: '/blog/posts',
        name: 'blog-posts',
        source: 'framework',
      });
      // _app.tsx should be skipped
      expect(routes.find((r) => r.name === '_app')).toBeUndefined();
    });

    it('skips _app.tsx and _document.tsx', async () => {
      mockAccess.mockImplementation(async (path) => {
        if (String(path).includes('pages')) return undefined;
        throw new Error('ENOENT');
      });

      mockReaddir.mockResolvedValueOnce([
        { name: 'index.tsx', isDirectory: () => false, isFile: () => true },
        { name: '_app.tsx', isDirectory: () => false, isFile: () => true },
        { name: '_document.tsx', isDirectory: () => false, isFile: () => true },
      ] as any);

      const routes = await extractNextRoutes('/project');

      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/');
    });

    it('skips api/ directories', async () => {
      mockAccess.mockImplementation(async (path) => {
        if (String(path).includes('pages')) return undefined;
        throw new Error('ENOENT');
      });

      mockReaddir.mockResolvedValueOnce([
        { name: 'index.tsx', isDirectory: () => false, isFile: () => true },
        { name: 'api', isDirectory: () => true, isFile: () => false },
      ] as any);

      const routes = await extractNextRoutes('/project');

      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/');
    });
  });

  it('returns empty array when neither app/ nor pages/ exists', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));

    const routes = await extractNextRoutes('/project');

    expect(routes).toEqual([]);
  });
});
