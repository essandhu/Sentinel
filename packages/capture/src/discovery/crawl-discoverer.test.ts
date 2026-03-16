import { describe, it, expect } from 'vitest';
import { extractLinksFromHtml, deduplicateRoutes } from './crawl-discoverer.js';
import type { DiscoveredRoute } from './types.js';

describe('extractLinksFromHtml', () => {
  const baseUrl = 'https://example.com';

  it('extracts internal links from anchor tags', () => {
    const html = `
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    `;
    const links = extractLinksFromHtml(html, baseUrl);
    expect(links).toContain('/about');
    expect(links).toContain('/contact');
  });

  it('normalizes trailing slashes', () => {
    const html = `
      <a href="/about/">About</a>
      <a href="/about">About Again</a>
    `;
    const links = extractLinksFromHtml(html, baseUrl);
    // Should deduplicate after normalizing trailing slash
    const aboutCount = links.filter((l) => l === '/about').length;
    expect(aboutCount).toBe(1);
  });

  it('skips anchor-only links', () => {
    const html = `
      <a href="#section">Section</a>
      <a href="/page#section">Page</a>
    `;
    const links = extractLinksFromHtml(html, baseUrl);
    expect(links).not.toContain('#section');
    // /page#section should still extract as /page
    expect(links).toContain('/page');
  });

  it('skips mailto, tel, javascript, and data protocols', () => {
    const html = `
      <a href="mailto:test@example.com">Email</a>
      <a href="tel:+1234567890">Phone</a>
      <a href="javascript:void(0)">JS</a>
      <a href="data:text/html,<h1>hi</h1>">Data</a>
      <a href="/real-page">Real</a>
    `;
    const links = extractLinksFromHtml(html, baseUrl);
    expect(links).toEqual(['/real-page']);
  });

  it('handles relative links', () => {
    const html = `
      <a href="subpage">Subpage</a>
      <a href="../other">Other</a>
    `;
    const links = extractLinksFromHtml(html, `${baseUrl}/section/page`);
    expect(links).toContain('/section/subpage');
    expect(links).toContain('/other');
  });

  it('skips static asset extensions', () => {
    const html = `
      <a href="/image.png">PNG</a>
      <a href="/style.css">CSS</a>
      <a href="/script.js">JS</a>
      <a href="/doc.pdf">PDF</a>
      <a href="/font.woff">WOFF</a>
      <a href="/icon.svg">SVG</a>
      <a href="/photo.jpg">JPG</a>
      <a href="/anim.gif">GIF</a>
      <a href="/real-page">Real</a>
    `;
    const links = extractLinksFromHtml(html, baseUrl);
    expect(links).toEqual(['/real-page']);
  });

  it('filters out external links', () => {
    const html = `
      <a href="https://other.com/page">External</a>
      <a href="https://example.com/internal">Internal</a>
    `;
    const links = extractLinksFromHtml(html, baseUrl);
    expect(links).toEqual(['/internal']);
  });

  it('returns unique paths only', () => {
    const html = `
      <a href="/about">About 1</a>
      <a href="/about">About 2</a>
      <a href="/about">About 3</a>
    `;
    const links = extractLinksFromHtml(html, baseUrl);
    expect(links).toEqual(['/about']);
  });
});

describe('deduplicateRoutes', () => {
  it('removes duplicate paths', () => {
    const routes: DiscoveredRoute[] = [
      { path: '/about', name: 'about', source: 'crawl' },
      { path: '/about', name: 'about', source: 'crawl' },
    ];
    const result = deduplicateRoutes(routes);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/about');
  });

  it('keeps framework source over crawl source', () => {
    const routes: DiscoveredRoute[] = [
      { path: '/about', name: 'about', source: 'crawl' },
      { path: '/about', name: 'about-page', source: 'framework' },
    ];
    const result = deduplicateRoutes(routes);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('framework');
  });

  it('keeps sitemap source over crawl source', () => {
    const routes: DiscoveredRoute[] = [
      { path: '/contact', name: 'contact', source: 'crawl' },
      { path: '/contact', name: 'contact-page', source: 'sitemap' },
    ];
    const result = deduplicateRoutes(routes);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('sitemap');
  });

  it('keeps framework source over sitemap source', () => {
    const routes: DiscoveredRoute[] = [
      { path: '/home', name: 'home', source: 'sitemap' },
      { path: '/home', name: 'home-page', source: 'framework' },
    ];
    const result = deduplicateRoutes(routes);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('framework');
  });

  it('preserves routes with different paths', () => {
    const routes: DiscoveredRoute[] = [
      { path: '/about', name: 'about', source: 'crawl' },
      { path: '/contact', name: 'contact', source: 'crawl' },
      { path: '/home', name: 'home', source: 'framework' },
    ];
    const result = deduplicateRoutes(routes);
    expect(result).toHaveLength(3);
  });
});
