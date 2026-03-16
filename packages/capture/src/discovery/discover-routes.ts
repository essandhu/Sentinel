import type { DiscoveredRoute } from './types.js';
import { detectNextProject, extractNextRoutes } from './extractors/next-extractor.js';
import { detectAstroProject, extractAstroRoutes } from './extractors/astro-extractor.js';
import {
  detectSvelteKitProject,
  extractSvelteKitRoutes,
} from './extractors/sveltekit-extractor.js';
import { discoverFromSitemap } from './sitemap-discoverer.js';
import { crawlRoutes, deduplicateRoutes } from './crawl-discoverer.js';

export interface DiscoveryResult {
  routes: DiscoveredRoute[];
  framework: string | null;
  sources: string[];
}

interface FrameworkEntry {
  name: string;
  detect: (cwd: string) => Promise<boolean>;
  extract: (cwd: string) => Promise<DiscoveredRoute[]>;
}

const FRAMEWORKS: FrameworkEntry[] = [
  { name: 'next', detect: detectNextProject, extract: extractNextRoutes },
  { name: 'astro', detect: detectAstroProject, extract: extractAstroRoutes },
  { name: 'sveltekit', detect: detectSvelteKitProject, extract: extractSvelteKitRoutes },
];

export const discoverRoutes = async (
  cwd: string,
  baseUrl: string,
  options?: { crawlDepth?: number; crawlMaxPages?: number },
): Promise<DiscoveryResult> => {
  const allRoutes: DiscoveredRoute[] = [];
  const sources: string[] = [];
  let framework: string | null = null;

  // 1. Try framework extractors in priority order
  for (const fw of FRAMEWORKS) {
    if (await fw.detect(cwd)) {
      const routes = await fw.extract(cwd);
      if (routes.length > 0) {
        allRoutes.push(...routes);
        sources.push('framework');
      }
      framework = fw.name;
      break;
    }
  }

  // 2. Always try sitemap (supplements framework routes)
  const sitemapRoutes = await discoverFromSitemap(baseUrl);
  if (sitemapRoutes.length > 0) {
    allRoutes.push(...sitemapRoutes);
    sources.push('sitemap');
  }

  // 3. Fall back to crawl if no routes yet
  if (allRoutes.length === 0) {
    const crawled = await crawlRoutes(baseUrl, {
      maxDepth: options?.crawlDepth,
      maxPages: options?.crawlMaxPages,
    });
    if (crawled.length > 0) {
      allRoutes.push(...crawled);
      sources.push('crawl');
    }
  }

  // 4. Deduplicate all collected routes
  const routes = deduplicateRoutes(allRoutes);

  // 5. Guarantee at least root route
  if (routes.length === 0) {
    if (!sources.includes('crawl')) sources.push('crawl');
    return {
      routes: [{ path: '/', name: 'home', source: 'crawl' }],
      framework,
      sources,
    };
  }

  return { routes, framework, sources };
};
