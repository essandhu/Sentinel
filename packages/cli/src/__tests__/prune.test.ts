import { describe, it, expect } from 'vitest';
import { findOrphanedBaselines } from '../commands/prune-logic.js';

describe('findOrphanedBaselines', () => {
  const baselines = [
    { id: '1', url: '/', s3Key: 'base/1.png', viewport: '1280x720', browser: 'chromium' },
    { id: '2', url: '/about', s3Key: 'base/2.png', viewport: '1280x720', browser: 'chromium' },
    { id: '3', url: '/pricing', s3Key: 'base/3.png', viewport: '1280x720', browser: 'chromium' },
    { id: '4', url: '/old-page', s3Key: 'base/4.png', viewport: '1280x720', browser: 'chromium' },
  ];

  it('identifies baselines whose URL is not in config routes', () => {
    const configRoutes = ['/', '/about', '/pricing'];
    const orphans = findOrphanedBaselines(configRoutes, baselines);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].url).toBe('/old-page');
  });

  it('returns empty array when all baselines match config', () => {
    const configRoutes = ['/', '/about', '/pricing', '/old-page'];
    const orphans = findOrphanedBaselines(configRoutes, baselines);
    expect(orphans).toEqual([]);
  });

  it('returns all baselines when config has no routes', () => {
    const orphans = findOrphanedBaselines([], baselines);
    expect(orphans).toHaveLength(4);
  });

  it('handles empty baselines array', () => {
    const orphans = findOrphanedBaselines(['/', '/about'], []);
    expect(orphans).toEqual([]);
  });

  it('matches routes exactly (no partial matching)', () => {
    const configRoutes = ['/about'];
    const orphans = findOrphanedBaselines(configRoutes, [
      { id: '1', url: '/about', s3Key: 'base/1.png', viewport: '1280x720', browser: 'chromium' },
      { id: '2', url: '/about-us', s3Key: 'base/2.png', viewport: '1280x720', browser: 'chromium' },
    ]);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].url).toBe('/about-us');
  });

  it('treats same URL with different browsers as separate baselines', () => {
    const multiBrowserBaselines = [
      { id: '1', url: '/', s3Key: 'base/1.png', viewport: '1280x720', browser: 'chromium' },
      { id: '2', url: '/', s3Key: 'base/2.png', viewport: '1280x720', browser: 'firefox' },
      { id: '3', url: '/', s3Key: 'base/3.png', viewport: '1280x720', browser: 'webkit' },
      { id: '4', url: '/removed', s3Key: 'base/4.png', viewport: '1280x720', browser: 'chromium' },
      { id: '5', url: '/removed', s3Key: 'base/5.png', viewport: '1280x720', browser: 'firefox' },
    ];
    const configRoutes = ['/'];
    const orphans = findOrphanedBaselines(configRoutes, multiBrowserBaselines);
    expect(orphans).toHaveLength(2);
    expect(orphans.every(o => o.url === '/removed')).toBe(true);
  });

  it('does not orphan baselines that match config regardless of browser', () => {
    const multiBrowserBaselines = [
      { id: '1', url: '/', s3Key: 'base/1.png', viewport: '1280x720', browser: 'chromium' },
      { id: '2', url: '/', s3Key: 'base/2.png', viewport: '1280x720', browser: 'firefox' },
    ];
    const configRoutes = ['/'];
    const orphans = findOrphanedBaselines(configRoutes, multiBrowserBaselines);
    expect(orphans).toEqual([]);
  });
});
