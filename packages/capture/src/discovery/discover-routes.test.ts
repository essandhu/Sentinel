import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DiscoveredRoute } from './types.js';

// Mock all discovery modules
vi.mock('./extractors/next-extractor.js', () => ({
  detectNextProject: vi.fn(),
  extractNextRoutes: vi.fn(),
}));
vi.mock('./extractors/astro-extractor.js', () => ({
  detectAstroProject: vi.fn(),
  extractAstroRoutes: vi.fn(),
}));
vi.mock('./extractors/sveltekit-extractor.js', () => ({
  detectSvelteKitProject: vi.fn(),
  extractSvelteKitRoutes: vi.fn(),
}));
vi.mock('./sitemap-discoverer.js', () => ({
  discoverFromSitemap: vi.fn(),
}));
vi.mock('./crawl-discoverer.js', () => ({
  crawlRoutes: vi.fn(),
  deduplicateRoutes: vi.fn((routes: DiscoveredRoute[]) => routes),
}));

import { discoverRoutes } from './discover-routes.js';
import { detectNextProject, extractNextRoutes } from './extractors/next-extractor.js';
import { detectAstroProject, extractAstroRoutes } from './extractors/astro-extractor.js';
import {
  detectSvelteKitProject,
  extractSvelteKitRoutes,
} from './extractors/sveltekit-extractor.js';
import { discoverFromSitemap } from './sitemap-discoverer.js';
import { crawlRoutes, deduplicateRoutes } from './crawl-discoverer.js';

const CWD = '/fake/project';
const BASE = 'http://localhost:3000';

describe('discoverRoutes', () => {
  beforeEach(() => {
    vi.mocked(detectNextProject).mockResolvedValue(false);
    vi.mocked(detectAstroProject).mockResolvedValue(false);
    vi.mocked(detectSvelteKitProject).mockResolvedValue(false);
    vi.mocked(extractNextRoutes).mockResolvedValue([]);
    vi.mocked(extractAstroRoutes).mockResolvedValue([]);
    vi.mocked(extractSvelteKitRoutes).mockResolvedValue([]);
    vi.mocked(discoverFromSitemap).mockResolvedValue([]);
    vi.mocked(crawlRoutes).mockResolvedValue([]);
    vi.mocked(deduplicateRoutes).mockImplementation((routes) => routes);
  });

  it('uses framework extractor when framework is detected', async () => {
    const frameworkRoutes: DiscoveredRoute[] = [
      { path: '/', name: 'home', source: 'framework' },
      { path: '/about', name: 'about', source: 'framework' },
    ];
    vi.mocked(detectNextProject).mockResolvedValue(true);
    vi.mocked(extractNextRoutes).mockResolvedValue(frameworkRoutes);
    vi.mocked(deduplicateRoutes).mockReturnValue(frameworkRoutes);

    const result = await discoverRoutes(CWD, BASE);

    expect(result.framework).toBe('next');
    expect(result.routes).toEqual(frameworkRoutes);
    expect(result.sources).toContain('framework');
    expect(crawlRoutes).not.toHaveBeenCalled();
  });

  it('falls back to sitemap when no framework is detected', async () => {
    const sitemapRoutes: DiscoveredRoute[] = [
      { path: '/', name: 'home', source: 'sitemap' },
      { path: '/blog', name: 'blog', source: 'sitemap' },
    ];
    vi.mocked(discoverFromSitemap).mockResolvedValue(sitemapRoutes);
    vi.mocked(deduplicateRoutes).mockReturnValue(sitemapRoutes);

    const result = await discoverRoutes(CWD, BASE);

    expect(result.framework).toBeNull();
    expect(result.routes).toEqual(sitemapRoutes);
    expect(result.sources).toContain('sitemap');
    expect(crawlRoutes).not.toHaveBeenCalled();
  });

  it('falls back to crawl when sitemap returns nothing', async () => {
    const crawledRoutes: DiscoveredRoute[] = [
      { path: '/', name: 'home', source: 'crawl' },
    ];
    vi.mocked(crawlRoutes).mockResolvedValue(crawledRoutes);
    vi.mocked(deduplicateRoutes).mockReturnValue(crawledRoutes);

    const result = await discoverRoutes(CWD, BASE);

    expect(result.framework).toBeNull();
    expect(result.routes).toEqual(crawledRoutes);
    expect(result.sources).toContain('crawl');
  });

  it('merges framework and sitemap routes via deduplication', async () => {
    const frameworkRoutes: DiscoveredRoute[] = [
      { path: '/', name: 'home', source: 'framework' },
    ];
    const sitemapRoutes: DiscoveredRoute[] = [
      { path: '/', name: 'home', source: 'sitemap' },
      { path: '/blog', name: 'blog', source: 'sitemap' },
    ];
    const merged: DiscoveredRoute[] = [
      { path: '/', name: 'home', source: 'framework' },
      { path: '/blog', name: 'blog', source: 'sitemap' },
    ];
    vi.mocked(detectAstroProject).mockResolvedValue(true);
    vi.mocked(extractAstroRoutes).mockResolvedValue(frameworkRoutes);
    vi.mocked(discoverFromSitemap).mockResolvedValue(sitemapRoutes);
    vi.mocked(deduplicateRoutes).mockReturnValue(merged);

    const result = await discoverRoutes(CWD, BASE);

    expect(result.framework).toBe('astro');
    expect(result.routes).toEqual(merged);
    expect(result.sources).toContain('framework');
    expect(result.sources).toContain('sitemap');
    expect(deduplicateRoutes).toHaveBeenCalledWith([
      ...frameworkRoutes,
      ...sitemapRoutes,
    ]);
  });

  it('returns at least root route when all discovery fails', async () => {
    vi.mocked(deduplicateRoutes).mockReturnValue([]);

    const result = await discoverRoutes(CWD, BASE);

    expect(result.routes).toEqual([
      { path: '/', name: 'home', source: 'crawl' },
    ]);
    expect(result.sources).toContain('crawl');
  });
});
