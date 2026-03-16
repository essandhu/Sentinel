import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectAstroProject, extractAstroRoutes } from './astro-extractor.js';

vi.mock('node:fs/promises');

import { readFile, readdir, access } from 'node:fs/promises';

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockAccess = vi.mocked(access);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('detectAstroProject', () => {
  it('returns true when astro is in dependencies', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ dependencies: { astro: '^4.0.0' } }),
    );

    expect(await detectAstroProject('/project')).toBe(true);
    expect(mockReadFile).toHaveBeenCalledWith(join('/project', 'package.json'), 'utf-8');
  });

  it('returns true when astro is in devDependencies', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ devDependencies: { astro: '^4.0.0' } }),
    );

    expect(await detectAstroProject('/project')).toBe(true);
  });

  it('returns false when astro is not in any dependencies', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ dependencies: { react: '^18.0.0' } }),
    );

    expect(await detectAstroProject('/project')).toBe(false);
  });

  it('returns false when package.json does not exist', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    expect(await detectAstroProject('/project')).toBe(false);
  });
});

describe('extractAstroRoutes', () => {
  it('finds .astro files in src/pages and converts to routes', async () => {
    mockAccess.mockResolvedValue(undefined);

    mockReaddir
      .mockResolvedValueOnce([
        { name: 'index.astro', isDirectory: () => false, isFile: () => true },
        { name: 'about.astro', isDirectory: () => false, isFile: () => true },
        { name: 'blog', isDirectory: () => true, isFile: () => false },
      ] as any)
      .mockResolvedValueOnce([
        { name: 'index.astro', isDirectory: () => false, isFile: () => true },
      ] as any);

    const routes = await extractAstroRoutes('/project');

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
  });

  it('finds .md, .mdx, and .html files as routes', async () => {
    mockAccess.mockResolvedValue(undefined);

    mockReaddir.mockResolvedValueOnce([
      { name: 'index.astro', isDirectory: () => false, isFile: () => true },
      { name: 'docs.md', isDirectory: () => false, isFile: () => true },
      { name: 'guide.mdx', isDirectory: () => false, isFile: () => true },
      { name: 'legacy.html', isDirectory: () => false, isFile: () => true },
    ] as any);

    const routes = await extractAstroRoutes('/project');

    expect(routes).toHaveLength(4);
    expect(routes.map((r) => r.path)).toContain('/');
    expect(routes.map((r) => r.path)).toContain('/docs');
    expect(routes.map((r) => r.path)).toContain('/guide');
    expect(routes.map((r) => r.path)).toContain('/legacy');
  });

  it('skips dynamic [slug].astro files', async () => {
    mockAccess.mockResolvedValue(undefined);

    mockReaddir.mockResolvedValueOnce([
      { name: 'index.astro', isDirectory: () => false, isFile: () => true },
      { name: '[slug].astro', isDirectory: () => false, isFile: () => true },
    ] as any);

    const routes = await extractAstroRoutes('/project');

    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe('/');
  });

  it('skips dynamic [slug] directories', async () => {
    mockAccess.mockResolvedValue(undefined);

    mockReaddir.mockResolvedValueOnce([
      { name: 'index.astro', isDirectory: () => false, isFile: () => true },
      { name: '[slug]', isDirectory: () => true, isFile: () => false },
      { name: 'about', isDirectory: () => true, isFile: () => false },
    ] as any)
    .mockResolvedValueOnce([
      { name: 'index.astro', isDirectory: () => false, isFile: () => true },
    ] as any);

    const routes = await extractAstroRoutes('/project');

    expect(routes).toHaveLength(2);
    expect(routes.map((r) => r.path)).toContain('/');
    expect(routes.map((r) => r.path)).toContain('/about');
  });

  it('returns empty array when src/pages does not exist', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));

    const routes = await extractAstroRoutes('/project');

    expect(routes).toEqual([]);
  });
});
