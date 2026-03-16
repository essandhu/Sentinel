import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { DiscoveredRoute, RouteExtractor } from '../types.js';

const PAGE_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js']);
const SPECIAL_FILES = new Set([
  'layout',
  'loading',
  'error',
  'not-found',
  'template',
  'default',
]);
const PAGES_SPECIAL_FILES = new Set(['_app', '_document', '_error', '404', '500']);

const isDynamic = (name: string): boolean => name.startsWith('[');
const isRouteGroup = (name: string): boolean =>
  name.startsWith('(') && name.endsWith(')');
const isApiDir = (name: string): boolean => name === 'api';

const pathToName = (routePath: string): string => {
  if (routePath === '/') return 'home';
  return routePath.slice(1).replace(/\//g, '-');
};

const dirExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const findAppDir = async (cwd: string): Promise<string | null> => {
  for (const candidate of ['app', 'src/app']) {
    const full = join(cwd, candidate);
    if (await dirExists(full)) return full;
  }
  return null;
};

const findPagesDir = async (cwd: string): Promise<string | null> => {
  for (const candidate of ['pages', 'src/pages']) {
    const full = join(cwd, candidate);
    if (await dirExists(full)) return full;
  }
  return null;
};

const extractAppRoutes = async (
  dir: string,
  basePath: string = '',
): Promise<DiscoveredRoute[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const routes: DiscoveredRoute[] = [];

  const hasPage = entries.some(
    (e) => e.isFile() && e.name.startsWith('page.'),
  );

  if (hasPage) {
    const routePath = basePath || '/';
    routes.push({ path: routePath, name: pathToName(routePath), source: 'framework' });
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (isDynamic(entry.name)) continue;
    if (isRouteGroup(entry.name)) continue;
    if (isApiDir(entry.name)) continue;

    const nested = await extractAppRoutes(
      join(dir, entry.name),
      `${basePath}/${entry.name}`,
    );
    routes.push(...nested);
  }

  return routes;
};

const stripExtension = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};

const hasPageExtension = (name: string): boolean => {
  const dot = name.lastIndexOf('.');
  return dot > 0 && PAGE_EXTENSIONS.has(name.slice(dot));
};

const extractPagesRoutes = async (
  dir: string,
  basePath: string = '',
): Promise<DiscoveredRoute[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const routes: DiscoveredRoute[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (isDynamic(entry.name)) continue;
      if (isApiDir(entry.name)) continue;

      const nested = await extractPagesRoutes(
        join(dir, entry.name),
        `${basePath}/${entry.name}`,
      );
      routes.push(...nested);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!hasPageExtension(entry.name)) continue;

    const stem = stripExtension(entry.name);
    if (PAGES_SPECIAL_FILES.has(stem)) continue;
    if (isDynamic(stem)) continue;

    if (stem === 'index') {
      const routePath = basePath || '/';
      routes.push({ path: routePath, name: pathToName(routePath), source: 'framework' });
    } else {
      const routePath = `${basePath}/${stem}`;
      routes.push({ path: routePath, name: pathToName(routePath), source: 'framework' });
    }
  }

  return routes;
};

export const detectNextProject = async (cwd: string): Promise<boolean> => {
  try {
    const raw = await readFile(join(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    return !!(pkg.dependencies?.next || pkg.devDependencies?.next);
  } catch {
    return false;
  }
};

export const extractNextRoutes = async (
  cwd: string,
): Promise<DiscoveredRoute[]> => {
  const appDir = await findAppDir(cwd);
  if (appDir) return extractAppRoutes(appDir);

  const pagesDir = await findPagesDir(cwd);
  if (pagesDir) return extractPagesRoutes(pagesDir);

  return [];
};

export const nextExtractor: RouteExtractor = {
  name: 'next',
  detect: detectNextProject,
  extract: extractNextRoutes,
};
