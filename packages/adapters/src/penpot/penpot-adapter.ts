import type { DesignSourceAdapter, DesignSpec, AdapterConfig } from '@sentinel-vrt/types';
import type { PenpotAdapterConfig } from '../types.js';
import { getPenpotFileComponents, exportPenpotComponent } from './penpot-client.js';
import pLimit from 'p-limit';

/**
 * PenpotAdapter implements DesignSourceAdapter for Penpot design tool.
 *
 * Connects to a Penpot instance via RPC API, fetches file components,
 * and exports them as PNG images for use as visual baselines.
 *
 * Concurrency limited to 3 simultaneous exports to be kind to the Penpot server.
 * Failed exports are skipped gracefully (best-effort pattern).
 */
export class PenpotAdapter implements DesignSourceAdapter {
  readonly name = 'penpot';

  async loadAll(config: AdapterConfig): Promise<DesignSpec[]> {
    const {
      instanceUrl,
      accessToken,
      fileId,
      componentIds,
    } = config as PenpotAdapterConfig;

    // Fetch all components from the file
    const allComponents = await getPenpotFileComponents(instanceUrl, accessToken, fileId);

    // Filter to specific componentIds if provided
    const components = componentIds
      ? allComponents.filter((c) => componentIds.includes(c.id))
      : allComponents;

    // Concurrency-limited export
    const limit = pLimit(3);
    const capturedAt = new Date().toISOString();

    const results = await Promise.all(
      components.map((component) =>
        limit(async () => {
          const buffer = await exportPenpotComponent(
            instanceUrl,
            accessToken,
            fileId,
            component.id,
          );

          if (!buffer) {
            return null;
          }

          const spec: DesignSpec = {
            sourceType: 'penpot',
            referenceImage: buffer,
            metadata: {
              componentName: component.name,
              penpotComponentId: component.id,
              capturedAt,
            },
          };

          return spec;
        }),
      ),
    );

    // Filter out failed exports (null results)
    return results.filter((spec): spec is DesignSpec => spec !== null);
  }

  async load(config: AdapterConfig): Promise<DesignSpec> {
    const specs = await this.loadAll(config);
    if (specs.length === 0) {
      throw new Error('No Penpot components could be exported');
    }
    return specs[0];
  }
}
