import pkg from 'sketch-constructor';
const { Sketch } = pkg;
import AdmZip from 'adm-zip';

export interface SketchArtboard {
  name: string;
  id: string;
  width: number;
  height: number;
  pageId: string;
  pageName: string;
}

/**
 * Parse a .sketch file (ZIP) and extract artboard metadata from all pages.
 */
export async function parseSketchFile(filePath: string): Promise<SketchArtboard[]> {
  const sketch = await Sketch.fromFile(filePath);
  const pages = sketch.getPages();
  const artboards: SketchArtboard[] = [];

  for (const page of pages) {
    const pageArtboards = page.getArtboards();
    for (const ab of pageArtboards) {
      artboards.push({
        name: ab.name,
        id: ab.do_objectID,
        width: ab.frame.width,
        height: ab.frame.height,
        pageId: page.do_objectID,
        pageName: page.name,
      });
    }
  }

  return artboards;
}

/**
 * Extract preview image from the .sketch ZIP's previews/preview.png entry.
 * Returns the image Buffer or null if no preview is present.
 */
export async function getSketchPreviews(filePath: string): Promise<Buffer | null> {
  const zip = new AdmZip(filePath);
  const entry = zip.getEntry('previews/preview.png');

  if (!entry) {
    return null;
  }

  return entry.getData();
}
