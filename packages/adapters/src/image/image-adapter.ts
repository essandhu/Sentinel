import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import fg from 'fast-glob';
import type { DesignSourceAdapter, DesignSpec, AdapterConfig } from '@sentinel/types';
import type { ImageAdapterConfig } from '../types.js';

export class ImageBaselineAdapter implements DesignSourceAdapter {
  readonly name = 'image-baseline';

  async loadAll(config: AdapterConfig): Promise<DesignSpec[]> {
    const { directory } = config as ImageAdapterConfig;

    const filePaths = await fg('**/*.png', {
      cwd: directory,
      absolute: true,
      onlyFiles: true,
    });

    return Promise.all(
      filePaths.map(async (filePath) => {
        const referenceImage = await readFile(filePath);
        const relativePath = relative(directory, filePath);
        // Normalize Windows backslashes to forward slashes, strip .png extension
        const componentName = relativePath.replace(/\\/g, '/').replace(/\.png$/i, '');

        const spec: DesignSpec = {
          sourceType: 'image',
          referenceImage,
          metadata: {
            componentName,
            capturedAt: new Date().toISOString(),
          },
        };

        return spec;
      })
    );
  }

  async load(config: AdapterConfig): Promise<DesignSpec> {
    const specs = await this.loadAll(config);

    if (specs.length === 0) {
      const { directory } = config as ImageAdapterConfig;
      throw new Error(`No PNG files found in directory: ${directory}`);
    }

    return specs[0];
  }
}
