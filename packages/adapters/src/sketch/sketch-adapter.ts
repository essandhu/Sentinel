import { readFile } from 'node:fs/promises';
import { basename, relative } from 'node:path';
import fg from 'fast-glob';
import type { DesignSourceAdapter, DesignSpec, AdapterConfig } from '@sentinel-vrt/types';
import type { SketchAdapterConfig } from '../types.js';
import { parseSketchFile, getSketchPreviews } from './sketch-parser.js';

export class SketchAdapter implements DesignSourceAdapter {
  readonly name = 'sketch';

  async loadAll(config: AdapterConfig): Promise<DesignSpec[]> {
    const { filePath, fallbackDirectory } = config as SketchAdapterConfig;

    const artboards = await parseSketchFile(filePath);
    const preview = await getSketchPreviews(filePath);

    // Case 1: Artboards found with embedded preview
    if (artboards.length > 0 && preview) {
      return artboards.map((ab) => ({
        sourceType: 'sketch' as const,
        referenceImage: preview,
        metadata: {
          componentName: ab.name,
          sketchArtboardId: ab.id,
          capturedAt: new Date().toISOString(),
        },
      }));
    }

    // Case 2: Artboards found, no preview, but fallback directory configured
    if (artboards.length > 0 && !preview && fallbackDirectory) {
      const pngPaths = await fg('**/*.png', {
        cwd: fallbackDirectory,
        absolute: true,
        onlyFiles: true,
      });

      // Build a map of artboard names (lowercased) to artboard data for matching
      const artboardMap = new Map(
        artboards.map((ab) => [ab.name.toLowerCase(), ab])
      );

      const specs: DesignSpec[] = await Promise.all(
        pngPaths.map(async (pngPath) => {
          const imageBuffer = await readFile(pngPath);
          const relativePath = relative(fallbackDirectory, pngPath);
          const componentName = relativePath.replace(/\\/g, '/').replace(/\.png$/i, '');
          const matchedArtboard = artboardMap.get(componentName.toLowerCase());

          return {
            sourceType: 'sketch' as const,
            referenceImage: imageBuffer,
            metadata: {
              componentName,
              sketchArtboardId: matchedArtboard?.id,
              capturedAt: new Date().toISOString(),
            },
          };
        })
      );

      return specs;
    }

    // Case 3: Artboards found, no preview, no fallback -> metadata-only
    if (artboards.length > 0) {
      return artboards.map((ab) => ({
        sourceType: 'sketch' as const,
        metadata: {
          componentName: ab.name,
          sketchArtboardId: ab.id,
          capturedAt: new Date().toISOString(),
        },
      }));
    }

    // Case 4: No artboards, but fallback directory configured
    if (fallbackDirectory) {
      const pngPaths = await fg('**/*.png', {
        cwd: fallbackDirectory,
        absolute: true,
        onlyFiles: true,
      });

      return Promise.all(
        pngPaths.map(async (pngPath) => {
          const imageBuffer = await readFile(pngPath);
          const relativePath = relative(fallbackDirectory, pngPath);
          const componentName = relativePath.replace(/\\/g, '/').replace(/\.png$/i, '');

          return {
            sourceType: 'sketch' as const,
            referenceImage: imageBuffer,
            metadata: {
              componentName,
              capturedAt: new Date().toISOString(),
            },
          };
        })
      );
    }

    // No artboards, no fallback
    return [];
  }

  async load(config: AdapterConfig): Promise<DesignSpec> {
    const specs = await this.loadAll(config);

    if (specs.length === 0) {
      throw new Error('No artboards or fallback images found');
    }

    return specs[0];
  }
}
