import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { DiscoveredRoute, RouteExtractor } from '../types.js';

const isDynamic = (name: string): boolean => name.startsWith('[');
const isRouteGroup = (name: string): boolean =>
  name.startsWith('(') && name.endsWith(')');

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

const extractRoutes = async (
  dir: string,
  basePath: string = '',
): Promise<DiscoveredRoute[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const routes: DiscoveredRoute[] = [];

  const hasPage = entries.some(
    (e) => e.isFile() && e.name === '+page.svelte',
  );

  if (hasPage) {
    const routePath = basePath || '/';
    routes.push({ path: routePath, name: pathToName(routePath), source: 'framework' });
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (isDynamic(entry.name)) continue;
    if (isRouteGroup(entry.name)) continue;

    const nested = await extractRoutes(
      join(dir, entry.name),
      `${basePath}/${entry.name}`,
    );
    routes.push(...nested);
  }

  return routes;
};

export const detectSvelteKitProject = async (cwd: string): Promise<boolean> => {
  try {
    const raw = await readFile(join(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    return !!(pkg.dependencies?.['@sveltejs/kit'] || pkg.devDependencies?.['@sveltejs/kit']);
  } catch {
    return false;
  }
};

export const extractSvelteKitRoutes = async (
  cwd: string,
): Promise<DiscoveredRoute[]> => {
  const routesDir = join(cwd, 'src/routes');
  if (!(await dirExists(routesDir))) return [];

  return extractRoutes(routesDir);
};

export const sveltekitExtractor: RouteExtractor = {
  name: 'sveltekit',
  detect: detectSvelteKitProject,
  extract: extractSvelteKitRoutes,
};
