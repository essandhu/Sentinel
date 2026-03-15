import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sketch-parser
vi.mock('./sketch-parser.js', () => ({
  parseSketchFile: vi.fn(),
  getSketchPreviews: vi.fn(),
}));

// Mock fast-glob
vi.mock('fast-glob', () => ({
  default: vi.fn(),
}));

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { parseSketchFile, getSketchPreviews } from './sketch-parser.js';
import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';

describe('SketchAdapter', () => {
  let SketchAdapter: typeof import('./sketch-adapter.js').SketchAdapter;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./sketch-adapter.js');
    SketchAdapter = mod.SketchAdapter;
  });

  it('has name "sketch"', () => {
    const adapter = new SketchAdapter();
    expect(adapter.name).toBe('sketch');
  });

  it('loadAll returns DesignSpec[] with sketch sourceType and artboard metadata', async () => {
    vi.mocked(parseSketchFile).mockResolvedValue([
      { name: 'Login', id: 'ab-1', width: 375, height: 812, pageId: 'p1', pageName: 'Page 1' },
      { name: 'Dashboard', id: 'ab-2', width: 1440, height: 900, pageId: 'p1', pageName: 'Page 1' },
    ]);
    vi.mocked(getSketchPreviews).mockResolvedValue(null);

    const adapter = new SketchAdapter();
    const specs = await adapter.loadAll({ filePath: '/path/to/design.sketch' });

    expect(specs).toHaveLength(2);
    expect(specs[0].sourceType).toBe('sketch');
    expect(specs[0].metadata.componentName).toBe('Login');
    expect(specs[0].metadata.sketchArtboardId).toBe('ab-1');
    expect(specs[1].sourceType).toBe('sketch');
    expect(specs[1].metadata.componentName).toBe('Dashboard');
    expect(specs[1].metadata.sketchArtboardId).toBe('ab-2');
  });

  it('loadAll uses preview image as referenceImage when available', async () => {
    const previewBuf = Buffer.from('preview-image-data');
    vi.mocked(parseSketchFile).mockResolvedValue([
      { name: 'Login', id: 'ab-1', width: 375, height: 812, pageId: 'p1', pageName: 'Page 1' },
    ]);
    vi.mocked(getSketchPreviews).mockResolvedValue(previewBuf);

    const adapter = new SketchAdapter();
    const specs = await adapter.loadAll({ filePath: '/path/to/design.sketch' });

    expect(specs).toHaveLength(1);
    expect(specs[0].referenceImage).toEqual(previewBuf);
  });

  it('loadAll loads PNGs from fallbackDirectory when no preview and fallback configured', async () => {
    vi.mocked(parseSketchFile).mockResolvedValue([
      { name: 'Login', id: 'ab-1', width: 375, height: 812, pageId: 'p1', pageName: 'Page 1' },
    ]);
    vi.mocked(getSketchPreviews).mockResolvedValue(null);
    vi.mocked(fg).mockResolvedValue(['/fallback/Login.png', '/fallback/Settings.png']);
    vi.mocked(readFile).mockResolvedValue(Buffer.from('fallback-png-data') as any);

    const adapter = new SketchAdapter();
    const specs = await adapter.loadAll({
      filePath: '/path/to/design.sketch',
      fallbackDirectory: '/fallback',
    });

    expect(specs.length).toBeGreaterThanOrEqual(1);
    // Fallback PNGs should have referenceImage
    const specsWithImages = specs.filter((s) => s.referenceImage);
    expect(specsWithImages.length).toBeGreaterThan(0);
    for (const spec of specsWithImages) {
      expect(spec.sourceType).toBe('sketch');
    }
  });

  it('loadAll returns metadata-only specs when no preview and no fallback', async () => {
    vi.mocked(parseSketchFile).mockResolvedValue([
      { name: 'Login', id: 'ab-1', width: 375, height: 812, pageId: 'p1', pageName: 'Page 1' },
      { name: 'Dashboard', id: 'ab-2', width: 1440, height: 900, pageId: 'p1', pageName: 'Page 1' },
    ]);
    vi.mocked(getSketchPreviews).mockResolvedValue(null);

    const adapter = new SketchAdapter();
    const specs = await adapter.loadAll({ filePath: '/path/to/design.sketch' });

    expect(specs).toHaveLength(2);
    for (const spec of specs) {
      expect(spec.sourceType).toBe('sketch');
      expect(spec.referenceImage).toBeUndefined();
      expect(spec.metadata.sketchArtboardId).toBeDefined();
    }
  });

  it('load returns the first spec from loadAll', async () => {
    vi.mocked(parseSketchFile).mockResolvedValue([
      { name: 'Login', id: 'ab-1', width: 375, height: 812, pageId: 'p1', pageName: 'Page 1' },
      { name: 'Dashboard', id: 'ab-2', width: 1440, height: 900, pageId: 'p1', pageName: 'Page 1' },
    ]);
    vi.mocked(getSketchPreviews).mockResolvedValue(null);

    const adapter = new SketchAdapter();
    const spec = await adapter.load({ filePath: '/path/to/design.sketch' });

    expect(spec.sourceType).toBe('sketch');
    expect(spec.metadata.componentName).toBe('Login');
  });

  it('load throws when no artboards and no fallback images', async () => {
    vi.mocked(parseSketchFile).mockResolvedValue([]);
    vi.mocked(getSketchPreviews).mockResolvedValue(null);

    const adapter = new SketchAdapter();

    await expect(
      adapter.load({ filePath: '/path/to/empty.sketch' })
    ).rejects.toThrow(/no artboards or fallback images found/i);
  });

  it('handles parseSketchFile rejection gracefully in loadAll', async () => {
    vi.mocked(parseSketchFile).mockRejectedValue(new Error('corrupt zip'));

    const adapter = new SketchAdapter();

    await expect(
      adapter.loadAll({ filePath: '/path/to/corrupt.sketch' })
    ).rejects.toThrow('corrupt zip');
  });

  it('handles getSketchPreviews rejection gracefully', async () => {
    vi.mocked(parseSketchFile).mockResolvedValue([
      { name: 'Login', id: 'ab-1', width: 375, height: 812, pageId: 'p1', pageName: 'Page 1' },
    ]);
    vi.mocked(getSketchPreviews).mockRejectedValue(new Error('zip read error'));

    const adapter = new SketchAdapter();

    // The adapter does not catch preview errors, so they propagate
    await expect(
      adapter.loadAll({ filePath: '/path/to/bad-preview.sketch' })
    ).rejects.toThrow('zip read error');
  });
});
