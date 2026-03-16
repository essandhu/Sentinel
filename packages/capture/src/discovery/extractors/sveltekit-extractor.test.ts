import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectSvelteKitProject, extractSvelteKitRoutes } from './sveltekit-extractor.js';

vi.mock('node:fs/promises');

import { readFile, readdir, access } from 'node:fs/promises';

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockAccess = vi.mocked(access);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('detectSvelteKitProject', () => {
  it('returns true when @sveltejs/kit is in dependencies', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ dependencies: { '@sveltejs/kit': '^2.0.0' } }),
    );

    expect(await detectSvelteKitProject('/project')).toBe(true);
    expect(mockReadFile).toHaveBeenCalledWith(join('/project', 'package.json'), 'utf-8');
  });

  it('returns true when @sveltejs/kit is in devDependencies', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ devDependencies: { '@sveltejs/kit': '^2.0.0' } }),
    );

    expect(await detectSvelteKitProject('/project')).toBe(true);
  });

  it('returns false when @sveltejs/kit is not in any dependencies', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ dependencies: { svelte: '^4.0.0' } }),
    );

    expect(await detectSvelteKitProject('/project')).toBe(false);
  });

  it('returns false when package.json does not exist', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    expect(await detectSvelteKitProject('/project')).toBe(false);
  });
});

describe('extractSvelteKitRoutes', () => {
  it('finds +page.svelte files and converts to routes', async () => {
    mockAccess.mockResolvedValue(undefined);

    mockReaddir
      .mockResolvedValueOnce([
        { name: '+page.svelte', isDirectory: () => false, isFile: () => true },
        { name: 'about', isDirectory: () => true, isFile: () => false },
        { name: '+layout.svelte', isDirectory: () => false, isFile: () => true },
      ] as any)
      .mockResolvedValueOnce([
        { name: '+page.svelte', isDirectory: () => false, isFile: () => true },
      ] as any);

    const routes = await extractSvelteKitRoutes('/project');

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
    // +layout.svelte should not appear as a route
    expect(routes.find((r) => r.name === '+layout')).toBeUndefined();
  });

  it('skips dynamic [id] segments', async () => {
    mockAccess.mockResolvedValue(undefined);

    mockReaddir
      .mockResolvedValueOnce([
        { name: '+page.svelte', isDirectory: () => false, isFile: () => true },
        { name: '[id]', isDirectory: () => true, isFile: () => false },
        { name: 'about', isDirectory: () => true, isFile: () => false },
      ] as any)
      .mockResolvedValueOnce([
        { name: '+page.svelte', isDirectory: () => false, isFile: () => true },
      ] as any);

    const routes = await extractSvelteKitRoutes('/project');

    expect(routes).toHaveLength(2);
    expect(routes.map((r) => r.path)).toContain('/');
    expect(routes.map((r) => r.path)).toContain('/about');
  });

  it('skips (group) route segments', async () => {
    mockAccess.mockResolvedValue(undefined);

    mockReaddir.mockResolvedValueOnce([
      { name: '+page.svelte', isDirectory: () => false, isFile: () => true },
      { name: '(auth)', isDirectory: () => true, isFile: () => false },
    ] as any);

    const routes = await extractSvelteKitRoutes('/project');

    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe('/');
  });

  it('handles nested directories recursively', async () => {
    mockAccess.mockResolvedValue(undefined);

    mockReaddir
      .mockResolvedValueOnce([
        { name: '+page.svelte', isDirectory: () => false, isFile: () => true },
        { name: 'blog', isDirectory: () => true, isFile: () => false },
      ] as any)
      .mockResolvedValueOnce([
        { name: '+page.svelte', isDirectory: () => false, isFile: () => true },
        { name: 'posts', isDirectory: () => true, isFile: () => false },
      ] as any)
      .mockResolvedValueOnce([
        { name: '+page.svelte', isDirectory: () => false, isFile: () => true },
      ] as any);

    const routes = await extractSvelteKitRoutes('/project');

    expect(routes).toContainEqual({ path: '/', name: 'home', source: 'framework' });
    expect(routes).toContainEqual({ path: '/blog', name: 'blog', source: 'framework' });
    expect(routes).toContainEqual({ path: '/blog/posts', name: 'blog-posts', source: 'framework' });
  });

  it('returns empty array when src/routes does not exist', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));

    const routes = await extractSvelteKitRoutes('/project');

    expect(routes).toEqual([]);
  });
});
