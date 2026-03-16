import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseSitemapXml, discoverFromSitemap } from './sitemap-discoverer.js';

describe('parseSitemapXml', () => {
  it('extracts routes from standard sitemap XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/blog/post-1</loc></url>
</urlset>`;

    const routes = parseSitemapXml(xml, 'https://example.com');

    expect(routes).toEqual([
      { path: '/', name: 'home', source: 'sitemap' },
      { path: '/about', name: 'about', source: 'sitemap' },
      { path: '/blog/post-1', name: 'blog-post-1', source: 'sitemap' },
    ]);
  });

  it('filters out URLs from different domains', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://other.com/about</loc></url>
</urlset>`;

    const routes = parseSitemapXml(xml, 'https://example.com');

    expect(routes).toEqual([
      { path: '/', name: 'home', source: 'sitemap' },
    ]);
  });

  it('returns empty array for invalid XML', () => {
    const routes = parseSitemapXml('not xml at all', 'https://example.com');
    expect(routes).toEqual([]);
  });

  it('normalizes trailing slashes', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about/</loc></url>
  <url><loc>https://example.com/blog/posts/</loc></url>
</urlset>`;

    const routes = parseSitemapXml(xml, 'https://example.com');

    expect(routes).toEqual([
      { path: '/', name: 'home', source: 'sitemap' },
      { path: '/about', name: 'about', source: 'sitemap' },
      { path: '/blog/posts', name: 'blog-posts', source: 'sitemap' },
    ]);
  });
});

describe('discoverFromSitemap', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('fetches and parses sitemap.xml', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>`;

    fetchSpy.mockResolvedValue(new Response(xml, { status: 200 }));

    const routes = await discoverFromSitemap('https://example.com');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/sitemap.xml',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(routes).toEqual([
      { path: '/', name: 'home', source: 'sitemap' },
      { path: '/about', name: 'about', source: 'sitemap' },
    ]);
  });

  it('returns empty array on fetch error', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const routes = await discoverFromSitemap('https://example.com');

    expect(routes).toEqual([]);
  });

  it('returns empty array on 404 response', async () => {
    fetchSpy.mockResolvedValue(new Response('Not Found', { status: 404 }));

    const routes = await discoverFromSitemap('https://example.com');

    expect(routes).toEqual([]);
  });
});
