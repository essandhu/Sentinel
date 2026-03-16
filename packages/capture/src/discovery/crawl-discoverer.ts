import type { DiscoveredRoute } from './types.js';

const SKIP_PROTOCOLS = ['mailto:', 'tel:', 'javascript:', 'data:'];
const STATIC_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.css', '.js', '.mjs', '.cjs',
  '.pdf', '.doc', '.docx',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.tar', '.gz',
  '.mp3', '.mp4', '.avi', '.mov',
];

/**
 * Extract internal links from an HTML string, returning unique normalized paths.
 */
export function extractLinksFromHtml(html: string, pageUrl: string): string[] {
  const base = new URL(pageUrl);
  const seen = new Set<string>();
  const results: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;

  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const raw = match[1];

    // Skip anchor-only links
    if (raw.startsWith('#')) continue;

    // Skip non-http protocols
    if (SKIP_PROTOCOLS.some((p) => raw.toLowerCase().startsWith(p))) continue;

    // Resolve relative URLs
    let resolved: URL;
    try {
      resolved = new URL(raw, pageUrl);
    } catch {
      continue;
    }

    // Same-origin only
    if (resolved.hostname !== base.hostname) continue;

    // Get pathname, strip trailing slash (except root)
    let pathname = resolved.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // Skip static assets
    const lower = pathname.toLowerCase();
    if (STATIC_EXTENSIONS.some((ext) => lower.endsWith(ext))) continue;

    // Deduplicate
    if (!seen.has(pathname)) {
      seen.add(pathname);
      results.push(pathname);
    }
  }

  return results;
}

const SOURCE_PRIORITY: Record<DiscoveredRoute['source'], number> = {
  framework: 0,
  sitemap: 1,
  crawl: 2,
};

/**
 * Deduplicate routes by path, keeping the highest-priority source.
 * Priority: framework > sitemap > crawl.
 */
export function deduplicateRoutes(routes: DiscoveredRoute[]): DiscoveredRoute[] {
  const best = new Map<string, DiscoveredRoute>();

  for (const route of routes) {
    const existing = best.get(route.path);
    if (!existing || SOURCE_PRIORITY[route.source] < SOURCE_PRIORITY[existing.source]) {
      best.set(route.path, route);
    }
  }

  return Array.from(best.values());
}

/**
 * Convert a URL path to a human-readable route name.
 */
function pathToName(path: string): string {
  if (path === '/') return 'home';
  return path
    .replace(/^\//, '')
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '');
}

/**
 * BFS crawl starting from baseUrl, discovering internal routes.
 */
export async function crawlRoutes(
  baseUrl: string,
  options?: { maxDepth?: number; maxPages?: number },
): Promise<DiscoveredRoute[]> {
  const maxDepth = options?.maxDepth ?? 3;
  const maxPages = options?.maxPages ?? 50;

  const base = new URL(baseUrl);
  const visited = new Set<string>();
  const routes: DiscoveredRoute[] = [];

  // BFS queue: [url, depth]
  const queue: Array<[string, number]> = [[base.href, 0]];

  while (queue.length > 0 && visited.size < maxPages) {
    const [currentUrl, depth] = queue.shift()!;

    const currentParsed = new URL(currentUrl);
    let pathname = currentParsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    if (visited.has(pathname)) continue;
    visited.add(pathname);

    let html: string;
    try {
      const response = await fetch(currentUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: 'text/html' },
      });

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) continue;

      html = await response.text();
    } catch {
      continue;
    }

    routes.push({
      path: pathname,
      name: pathToName(pathname),
      source: 'crawl',
    });

    if (depth < maxDepth) {
      const links = extractLinksFromHtml(html, currentUrl);
      for (const link of links) {
        const fullUrl = new URL(link, baseUrl).href;
        queue.push([fullUrl, depth + 1]);
      }
    }
  }

  return routes;
}
