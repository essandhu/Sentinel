import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchDesignToRoute, discoverDesignImages } from './design-drift-matcher.js';

vi.mock('node:fs/promises', () => ({ readdir: vi.fn(), access: vi.fn() }));
import { readdir, access } from 'node:fs/promises';
const mockReaddir = vi.mocked(readdir);
const mockAccess = vi.mocked(access);

describe('matchDesignToRoute', () => {
  beforeEach(() => vi.clearAllMocks());
  it('matches by convention: routeName_viewport.png', async () => {
    mockAccess.mockResolvedValue(undefined);
    const result = await matchDesignToRoute('pricing', '1280x720', '/designs');
    expect(result).toBe('/designs/pricing_1280x720.png');
  });
  it('returns null when convention file does not exist', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    const result = await matchDesignToRoute('pricing', '1280x720', '/designs');
    expect(result).toBeNull();
  });
  it('uses explicit mapping when provided', async () => {
    mockAccess.mockResolvedValue(undefined);
    const mappings = [{ design: 'homepage-v2.png', route: '/', viewport: '1280x720' }];
    const result = await matchDesignToRoute('home', '1280x720', '/designs', mappings, '/');
    expect(result).toBe('/designs/homepage-v2.png');
  });
  it('explicit mapping takes precedence over convention', async () => {
    mockAccess.mockResolvedValue(undefined);
    const mappings = [{ design: 'custom.png', route: '/pricing', viewport: '1280x720' }];
    const result = await matchDesignToRoute('pricing', '1280x720', '/designs', mappings, '/pricing');
    expect(result).toBe('/designs/custom.png');
  });
  it('returns null when mapping file does not exist', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    const mappings = [{ design: 'missing.png', route: '/', viewport: '1280x720' }];
    const result = await matchDesignToRoute('home', '1280x720', '/designs', mappings, '/');
    expect(result).toBeNull();
  });
});

describe('discoverDesignImages', () => {
  beforeEach(() => vi.clearAllMocks());
  it('discovers images matching convention pattern', async () => {
    mockReaddir.mockResolvedValue(['home_1280x720.png', 'pricing_375x667.png', 'README.md', 'sketch.psd'] as any);
    const images = await discoverDesignImages('/designs');
    expect(images).toHaveLength(2);
    expect(images).toContainEqual({ routeName: 'home', viewport: '1280x720', filePath: '/designs/home_1280x720.png' });
    expect(images).toContainEqual({ routeName: 'pricing', viewport: '375x667', filePath: '/designs/pricing_375x667.png' });
  });
  it('returns empty array when directory does not exist', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT'));
    expect(await discoverDesignImages('/nonexistent')).toEqual([]);
  });
  it('ignores files not matching convention', async () => {
    mockReaddir.mockResolvedValue(['random-file.png', 'no-viewport.png', '.gitkeep'] as any);
    expect(await discoverDesignImages('/designs')).toEqual([]);
  });
});
