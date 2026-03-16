import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { DiscoveredRoute, RouteExtractor } from '../types.js';

const PAGE_EXTENSIONS = new Set(['.astro', '.md', '.mdx', '.html']);

const isDynamic = (name: string): boolean => name.startsWith('[');

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

const stripExtension = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};

const hasPageExtension = (name: string): boolean => {
  const dot = name.lastIndexOf('.');
  return dot > 0 && PAGE_EXTENSIONS.has(name.slice(dot));
};

const extractPages = async (
  dir: string,
  basePath: string = '',
): Promise<DiscoveredRoute[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const routes: DiscoveredRoute[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (isDynamic(entry.name)) continue;

      const nested = await extractPages(
        join(dir, entry.name),
        `${basePath}/${entry.name}`,
      );
      routes.push(...nested);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!hasPageExtension(entry.name)) continue;

    const stem = stripExtension(entry.name);
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

export const detectAstroProject = async (cwd: string): Promise<boolean> => {
  try {
    const raw = await readFile(join(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    return !!(pkg.dependencies?.astro || pkg.devDependencies?.astro);
  } catch {
    return false;
  }
};

export const extractAstroRoutes = async (
  cwd: string,
): Promise<DiscoveredRoute[]> => {
  const pagesDir = join(cwd, 'src/pages');
  if (!(await dirExists(pagesDir))) return [];

  return extractPages(pagesDir);
};

export const astroExtractor: RouteExtractor = {
  name: 'astro',
  detect: detectAstroProject,
  extract: extractAstroRoutes,
};
