import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverDesignImages } from './design-drift-matcher.js';
import { buildDriftComparisons, type CaptureForDrift } from './design-drift-runner.js';

describe('design drift pipeline (real filesystem)', () => {
  let designDir: string;

  beforeEach(async () => {
    designDir = await mkdtemp(join(tmpdir(), 'sentinel-drift-test-'));
  });

  afterEach(async () => {
    await rm(designDir, { recursive: true, force: true });
  });

  it('discovers convention-named PNGs and pairs them with captures', async () => {
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    await writeFile(join(designDir, 'home_1280x720.png'), pngHeader);
    await writeFile(join(designDir, 'pricing_375x667.png'), pngHeader);
    await writeFile(join(designDir, 'README.md'), 'not an image');

    const images = await discoverDesignImages(designDir);
    expect(images).toHaveLength(2);

    const captures: CaptureForDrift[] = [
      { routeName: 'home', routePath: '/', viewport: '1280x720', screenshotBuffer: Buffer.from('screenshot1') },
      { routeName: 'pricing', routePath: '/pricing', viewport: '375x667', screenshotBuffer: Buffer.from('screenshot2') },
      { routeName: 'about', routePath: '/about', viewport: '1280x720', screenshotBuffer: Buffer.from('screenshot3') },
    ];

    const comparisons = buildDriftComparisons(captures, images);
    expect(comparisons).toHaveLength(2);
    expect(comparisons.map(c => c.routeName).sort()).toEqual(['home', 'pricing']);
  });

  it('skips captures with no matching design image', async () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await writeFile(join(designDir, 'home_1280x720.png'), pngHeader);

    const images = await discoverDesignImages(designDir);
    const captures: CaptureForDrift[] = [
      { routeName: 'about', routePath: '/about', viewport: '1280x720', screenshotBuffer: Buffer.from('ss') },
    ];

    const comparisons = buildDriftComparisons(captures, images);
    expect(comparisons).toEqual([]);
  });

  it('returns empty comparisons when design directory is empty', async () => {
    const images = await discoverDesignImages(designDir);
    expect(images).toEqual([]);

    const captures: CaptureForDrift[] = [
      { routeName: 'home', routePath: '/', viewport: '1280x720', screenshotBuffer: Buffer.from('ss') },
    ];
    const comparisons = buildDriftComparisons(captures, images);
    expect(comparisons).toEqual([]);
  });

  it('matches viewport exactly (no partial matching)', async () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await writeFile(join(designDir, 'home_1280x720.png'), pngHeader);

    const images = await discoverDesignImages(designDir);
    const captures: CaptureForDrift[] = [
      { routeName: 'home', routePath: '/', viewport: '1920x1080', screenshotBuffer: Buffer.from('ss') },
    ];

    const comparisons = buildDriftComparisons(captures, images);
    expect(comparisons).toEqual([]);
  });
});
