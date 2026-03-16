import { describe, it, expect } from 'vitest';
import { buildDriftComparisons } from './design-drift-runner.js';

describe('buildDriftComparisons', () => {
  it('pairs captured routes with design images', () => {
    const captures = [
      { routeName: 'home', routePath: '/', viewport: '1280x720', screenshotBuffer: Buffer.from('img') },
      { routeName: 'pricing', routePath: '/pricing', viewport: '1280x720', screenshotBuffer: Buffer.from('img2') },
    ];
    const designImages = [
      { routeName: 'home', viewport: '1280x720', filePath: '/designs/home_1280x720.png' },
      { routeName: 'pricing', viewport: '1280x720', filePath: '/designs/pricing_1280x720.png' },
    ];
    const pairs = buildDriftComparisons(captures, designImages);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].routeName).toBe('home');
    expect(pairs[0].designPath).toBe('/designs/home_1280x720.png');
  });
  it('skips routes with no matching design image', () => {
    const captures = [
      { routeName: 'home', routePath: '/', viewport: '1280x720', screenshotBuffer: Buffer.from('img') },
      { routeName: 'about', routePath: '/about', viewport: '1280x720', screenshotBuffer: Buffer.from('img2') },
    ];
    const designImages = [{ routeName: 'home', viewport: '1280x720', filePath: '/designs/home_1280x720.png' }];
    const pairs = buildDriftComparisons(captures, designImages);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].routeName).toBe('home');
  });
  it('returns empty when no matches', () => {
    const pairs = buildDriftComparisons(
      [{ routeName: 'about', routePath: '/about', viewport: '1280x720', screenshotBuffer: Buffer.from('img') }],
      [{ routeName: 'home', viewport: '1280x720', filePath: '/designs/home_1280x720.png' }],
    );
    expect(pairs).toEqual([]);
  });
  it('matches by routeName AND viewport', () => {
    const captures = [
      { routeName: 'home', routePath: '/', viewport: '1280x720', screenshotBuffer: Buffer.from('img') },
      { routeName: 'home', routePath: '/', viewport: '375x667', screenshotBuffer: Buffer.from('img2') },
    ];
    const designImages = [{ routeName: 'home', viewport: '1280x720', filePath: '/designs/home_1280x720.png' }];
    const pairs = buildDriftComparisons(captures, designImages);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].viewport).toBe('1280x720');
  });
});
