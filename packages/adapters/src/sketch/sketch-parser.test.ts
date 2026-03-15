import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sketch-constructor
const mockFromFile = vi.hoisted(() => vi.fn());
vi.mock('sketch-constructor', () => {
  const Sketch = { fromFile: mockFromFile };
  return {
    default: { Sketch },
    Sketch,
  };
});

// Mock adm-zip (CJS module - constructor function)
let admZipInstance: any = {};
vi.mock('adm-zip', () => {
  const AdmZipMock = function () {
    return admZipInstance;
  };
  return { default: AdmZipMock };
});

import { Sketch } from 'sketch-constructor';

describe('parseSketchFile', () => {
  let parseSketchFile: typeof import('./sketch-parser.js').parseSketchFile;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./sketch-parser.js');
    parseSketchFile = mod.parseSketchFile;
  });

  it('extracts artboards from multiple pages correctly', async () => {
    const mockSketch = {
      getPages: vi.fn().mockReturnValue([
        {
          name: 'Page 1',
          do_objectID: 'page-1-id',
          getArtboards: vi.fn().mockReturnValue([
            {
              name: 'Login Screen',
              do_objectID: 'artboard-1',
              frame: { width: 375, height: 812 },
            },
            {
              name: 'Dashboard',
              do_objectID: 'artboard-2',
              frame: { width: 1440, height: 900 },
            },
          ]),
        },
        {
          name: 'Page 2',
          do_objectID: 'page-2-id',
          getArtboards: vi.fn().mockReturnValue([
            {
              name: 'Settings',
              do_objectID: 'artboard-3',
              frame: { width: 375, height: 667 },
            },
          ]),
        },
      ]),
    };
    vi.mocked(Sketch.fromFile).mockResolvedValue(mockSketch as any);

    const artboards = await parseSketchFile('/path/to/design.sketch');

    expect(artboards).toHaveLength(3);
    expect(artboards[0]).toEqual({
      name: 'Login Screen',
      id: 'artboard-1',
      width: 375,
      height: 812,
      pageId: 'page-1-id',
      pageName: 'Page 1',
    });
    expect(artboards[1]).toEqual({
      name: 'Dashboard',
      id: 'artboard-2',
      width: 1440,
      height: 900,
      pageId: 'page-1-id',
      pageName: 'Page 1',
    });
    expect(artboards[2]).toEqual({
      name: 'Settings',
      id: 'artboard-3',
      width: 375,
      height: 667,
      pageId: 'page-2-id',
      pageName: 'Page 2',
    });
  });

  it('returns empty array when no artboard layers exist', async () => {
    const mockSketch = {
      getPages: vi.fn().mockReturnValue([
        {
          name: 'Page 1',
          do_objectID: 'page-1-id',
          getArtboards: vi.fn().mockReturnValue([]),
        },
      ]),
    };
    vi.mocked(Sketch.fromFile).mockResolvedValue(mockSketch as any);

    const artboards = await parseSketchFile('/path/to/empty.sketch');

    expect(artboards).toHaveLength(0);
  });

  it('propagates error when file does not exist', async () => {
    vi.mocked(Sketch.fromFile).mockRejectedValue(
      new Error('ENOENT: no such file or directory')
    );

    await expect(parseSketchFile('/nonexistent.sketch')).rejects.toThrow(
      /no such file/i
    );
  });
});

describe('getSketchPreviews', () => {
  let getSketchPreviews: typeof import('./sketch-parser.js').getSketchPreviews;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./sketch-parser.js');
    getSketchPreviews = mod.getSketchPreviews;
  });

  it('returns Buffer when previews/preview.png exists in ZIP', async () => {
    const previewBuffer = Buffer.from('fake-preview-image');
    const mockEntry = {
      getData: vi.fn().mockReturnValue(previewBuffer),
    };
    admZipInstance = {
      getEntry: vi.fn().mockReturnValue(mockEntry),
    };

    const result = await getSketchPreviews('/path/to/design.sketch');

    expect(result).toBeInstanceOf(Buffer);
    expect(result).toEqual(previewBuffer);
    expect(admZipInstance.getEntry).toHaveBeenCalledWith('previews/preview.png');
  });

  it('returns null when previews/preview.png does not exist', async () => {
    admZipInstance = {
      getEntry: vi.fn().mockReturnValue(null),
    };

    const result = await getSketchPreviews('/path/to/design.sketch');

    expect(result).toBeNull();
  });
});

describe('parseSketchFile edge cases', () => {
  let parseSketchFile: typeof import('./sketch-parser.js').parseSketchFile;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./sketch-parser.js');
    parseSketchFile = mod.parseSketchFile;
  });

  it('handles sketch-constructor returning null pages array', async () => {
    const mockSketch = {
      getPages: vi.fn().mockReturnValue(null),
    };
    vi.mocked(Sketch.fromFile).mockResolvedValue(mockSketch as any);

    // for...of null throws TypeError
    await expect(parseSketchFile('/path/to/bad.sketch')).rejects.toThrow(TypeError);
  });

  it('handles artboard with missing frame dimensions', async () => {
    const mockSketch = {
      getPages: vi.fn().mockReturnValue([
        {
          name: 'Page 1',
          do_objectID: 'page-1-id',
          getArtboards: vi.fn().mockReturnValue([
            {
              name: 'Broken Artboard',
              do_objectID: 'artboard-broken',
              frame: undefined,
            },
          ]),
        },
      ]),
    };
    vi.mocked(Sketch.fromFile).mockResolvedValue(mockSketch as any);

    // Accessing undefined.width throws TypeError
    await expect(parseSketchFile('/path/to/broken.sketch')).rejects.toThrow(TypeError);
  });
});
