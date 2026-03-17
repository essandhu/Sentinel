import type { DesignSourceAdapter, DesignSpec, AdapterConfig } from '@sentinel-vrt/types';
import type { StorybookAdapterConfig } from '../types.js';

interface StorybookEntry {
  id: string;
  title: string;
  name: string;
  type?: string;
  kind?: string;
}

interface StorybookIndex {
  entries?: Record<string, StorybookEntry>;
  stories?: Record<string, StorybookEntry>;
}

export class StorybookAdapter implements DesignSourceAdapter {
  readonly name = 'storybook';

  private async fetchIndex(storybookUrl: string): Promise<{ entries: Record<string, StorybookEntry>; source: 'index' | 'stories' }> {
    const base = storybookUrl.replace(/\/$/, '');
    const headers = { Accept: 'application/json' };

    // Try Storybook 8: /index.json
    const indexResponse = await fetch(`${base}/index.json`, { headers });

    if (indexResponse.ok) {
      const data = (await indexResponse.json()) as StorybookIndex;
      const entries = data.entries ?? {};
      return { entries, source: 'index' };
    }

    const indexStatus = indexResponse.status;

    // Fallback to Storybook 7: /stories.json
    const storiesResponse = await fetch(`${base}/stories.json`, { headers });

    if (storiesResponse.ok) {
      const data = (await storiesResponse.json()) as StorybookIndex;
      const entries = data.stories ?? {};
      return { entries, source: 'stories' };
    }

    const storiesStatus = storiesResponse.status;
    throw new Error(
      `Failed to fetch Storybook index: /index.json returned ${indexStatus}, /stories.json returned ${storiesStatus}`
    );
  }

  async loadAll(config: AdapterConfig): Promise<DesignSpec[]> {
    const { storybookUrl, storyIds } = config as StorybookAdapterConfig;

    const { entries } = await this.fetchIndex(storybookUrl);

    const capturedAt = new Date().toISOString();

    let stories = Object.values(entries).filter(
      (entry) => entry.type !== 'docs'
    );

    if (storyIds && storyIds.length > 0) {
      const idSet = new Set(storyIds);
      stories = stories.filter((entry) => idSet.has(entry.id));
    }

    return stories.map((entry): DesignSpec => ({
      sourceType: 'storybook',
      metadata: {
        componentName: entry.title,
        storyId: entry.id,
        capturedAt,
      },
    }));
  }

  async load(config: AdapterConfig): Promise<DesignSpec> {
    const specs = await this.loadAll(config);
    if (specs.length === 0) {
      throw new Error('No stories found in Storybook index');
    }
    return specs[0];
  }
}

/**
 * Constructs the Playwright-capturable iframe URL for a Storybook story.
 * @param storybookUrl - Base URL of the Storybook instance (e.g. "http://localhost:6006")
 * @param storyId - Story ID (e.g. "button--primary")
 * @returns Full iframe URL (e.g. "http://localhost:6006/iframe.html?id=button--primary&viewMode=story")
 */
export function storybookStoryUrl(storybookUrl: string, storyId: string): string {
  const base = storybookUrl.replace(/\/$/, '');
  return `${base}/iframe.html?id=${storyId}&viewMode=story`;
}
