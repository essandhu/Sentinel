import { describe, it, expect, vi, afterEach } from 'vitest';
import { StorybookAdapter, storybookStoryUrl } from './storybook-adapter.js';

// --- Fixtures ---

const SB8_INDEX_JSON = {
  v: 5,
  entries: {
    'button--primary': {
      id: 'button--primary',
      title: 'Button',
      name: 'Primary',
      type: 'story',
    },
    'button--secondary': {
      id: 'button--secondary',
      title: 'Button',
      name: 'Secondary',
      type: 'story',
    },
    'button--docs': {
      id: 'button--docs',
      title: 'Button',
      name: 'Docs',
      type: 'docs',
    },
    'card--default': {
      id: 'card--default',
      title: 'Card',
      name: 'Default',
      type: 'story',
    },
  },
};

const SB7_STORIES_JSON = {
  v: 3,
  stories: {
    'modal--open': {
      id: 'modal--open',
      title: 'Modal',
      name: 'Open',
      kind: 'Modal',
    },
    'modal--closed': {
      id: 'modal--closed',
      title: 'Modal',
      name: 'Closed',
      kind: 'Modal',
    },
  },
};

function mockFetchSuccess(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function mockFetch404(): Response {
  return {
    ok: false,
    status: 404,
    json: async () => ({}),
  } as Response;
}

describe('StorybookAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads stories from index.json (Storybook 8) and filters docs entries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchSuccess(SB8_INDEX_JSON));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new StorybookAdapter();
    const specs = await adapter.loadAll({ storybookUrl: 'http://localhost:6006' });

    // 3 story entries (button--primary, button--secondary, card--default) + 1 docs filtered
    expect(specs).toHaveLength(3);

    for (const spec of specs) {
      expect(spec.sourceType).toBe('storybook');
      expect(spec.metadata.storyId).toBeDefined();
      expect(spec.metadata.componentName).toBeDefined();
      expect(spec.metadata.capturedAt).toBeDefined();
    }
  });

  it('docs-type entries are filtered out from index.json', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchSuccess(SB8_INDEX_JSON));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new StorybookAdapter();
    const specs = await adapter.loadAll({ storybookUrl: 'http://localhost:6006' });

    const docsSpecs = specs.filter(s => s.metadata.storyId?.endsWith('--docs'));
    expect(docsSpecs).toHaveLength(0);
  });

  it('falls back to stories.json when index.json returns 404 (Storybook 7)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockFetch404()) // index.json fails
      .mockResolvedValueOnce(mockFetchSuccess(SB7_STORIES_JSON)); // stories.json succeeds
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new StorybookAdapter();
    const specs = await adapter.loadAll({ storybookUrl: 'http://localhost:6006' });

    expect(specs).toHaveLength(2);
    expect(specs[0].sourceType).toBe('storybook');
  });

  it('throws descriptive error with status codes when both endpoints fail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockFetch404())  // index.json 404
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) } as Response); // stories.json 503
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new StorybookAdapter();

    await expect(
      adapter.loadAll({ storybookUrl: 'http://localhost:6006' })
    ).rejects.toThrow(/404.*503|failed to fetch/i);
  });

  it('applies optional storyIds filter to limit returned stories', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchSuccess(SB8_INDEX_JSON));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new StorybookAdapter();
    const specs = await adapter.loadAll({
      storybookUrl: 'http://localhost:6006',
      storyIds: ['button--primary', 'card--default'],
    });

    expect(specs).toHaveLength(2);
    const ids = specs.map(s => s.metadata.storyId);
    expect(ids).toContain('button--primary');
    expect(ids).toContain('card--default');
    expect(ids).not.toContain('button--secondary');
  });

  it('sets metadata.componentName from story title', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchSuccess(SB8_INDEX_JSON));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new StorybookAdapter();
    const specs = await adapter.loadAll({ storybookUrl: 'http://localhost:6006' });

    const buttonSpec = specs.find(s => s.metadata.storyId === 'button--primary');
    expect(buttonSpec?.metadata.componentName).toBe('Button');

    const cardSpec = specs.find(s => s.metadata.storyId === 'card--default');
    expect(cardSpec?.metadata.componentName).toBe('Card');
  });

  it('sends Accept: application/json header on fetch calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchSuccess(SB8_INDEX_JSON));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new StorybookAdapter();
    await adapter.loadAll({ storybookUrl: 'http://localhost:6006' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options?.headers as Record<string, string>)?.Accept).toBe('application/json');
  });

  it('load() returns first DesignSpec', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchSuccess(SB8_INDEX_JSON));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new StorybookAdapter();
    const spec = await adapter.load({ storybookUrl: 'http://localhost:6006' });

    expect(spec.sourceType).toBe('storybook');
    expect(spec.metadata.storyId).toBeDefined();
  });
});

describe('storybookStoryUrl', () => {
  it('constructs correct iframe URL for a story', () => {
    const url = storybookStoryUrl('http://localhost:6006', 'button--primary');
    expect(url).toBe('http://localhost:6006/iframe.html?id=button--primary&viewMode=story');
  });

  it('handles trailing slash on storybookUrl', () => {
    const url = storybookStoryUrl('http://localhost:6006/', 'card--default');
    expect(url).toBe('http://localhost:6006/iframe.html?id=card--default&viewMode=story');
  });
});
