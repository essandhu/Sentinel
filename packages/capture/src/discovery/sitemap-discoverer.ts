import { XMLParser } from 'fast-xml-parser';
import type { DiscoveredRoute } from './types.js';

const pathToName = (routePath: string): string => {
  if (routePath === '/') return 'home';
  return routePath.slice(1).replace(/\//g, '-');
};

export function parseSitemapXml(xml: string, baseUrl: string): DiscoveredRoute[] {
  try {
    const parser = new XMLParser();
    const parsed = parser.parse(xml);

    const urlset = parsed?.urlset;
    if (!urlset?.url) return [];

    const urls: Array<{ loc?: string }> = Array.isArray(urlset.url)
      ? urlset.url
      : [urlset.url];

    const base = new URL(baseUrl);
    const routes: DiscoveredRoute[] = [];

    for (const entry of urls) {
      if (!entry.loc || typeof entry.loc !== 'string') continue;

      let entryUrl: URL;
      try {
        entryUrl = new URL(entry.loc);
      } catch {
        continue;
      }

      if (entryUrl.hostname !== base.hostname) continue;

      let path = entryUrl.pathname;
      // Normalize trailing slash: remove except for root
      if (path !== '/' && path.endsWith('/')) {
        path = path.slice(0, -1);
      }

      routes.push({
        path,
        name: pathToName(path),
        source: 'sitemap',
      });
    }

    return routes;
  } catch {
    return [];
  }
}

export async function discoverFromSitemap(baseUrl: string): Promise<DiscoveredRoute[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${baseUrl}/sitemap.xml`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return [];

    const xml = await response.text();
    return parseSitemapXml(xml, baseUrl);
  } catch {
    return [];
  }
}
