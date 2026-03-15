import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./penpot-client.js', () => ({
  getPenpotFileComponents: vi.fn(),
  exportPenpotComponent: vi.fn(),
}));

vi.mock('p-limit', () => ({
  default: () => <T>(fn: () => T) => fn(),
}));

describe('PenpotAdapter', () => {
  let PenpotAdapter: typeof import('./penpot-adapter.js').PenpotAdapter;
  let getPenpotFileComponents: ReturnType<typeof vi.fn>;
  let exportPenpotComponent: ReturnType<typeof vi.fn>;

  const baseConfig = {
    instanceUrl: 'https://penpot.example.com',
    accessToken: 'tok-123',
    fileId: 'file-1',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const adapterMod = await import('./penpot-adapter.js');
    PenpotAdapter = adapterMod.PenpotAdapter;
    const clientMod = await import('./penpot-client.js');
    getPenpotFileComponents = clientMod.getPenpotFileComponents as ReturnType<typeof vi.fn>;
    exportPenpotComponent = clientMod.exportPenpotComponent as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has name "penpot"', () => {
    const adapter = new PenpotAdapter();
    expect(adapter.name).toBe('penpot');
  });

  it('loadAll calls getPenpotFileComponents and exports all components', async () => {
    const components = [
      { id: 'comp-1', name: 'Button', type: 'component' },
      { id: 'comp-2', name: 'Card', type: 'component' },
    ];
    getPenpotFileComponents.mockResolvedValue(components);
    exportPenpotComponent
      .mockResolvedValueOnce(Buffer.from('png-button'))
      .mockResolvedValueOnce(Buffer.from('png-card'));

    const adapter = new PenpotAdapter();
    const specs = await adapter.loadAll(baseConfig);

    expect(getPenpotFileComponents).toHaveBeenCalledWith(
      'https://penpot.example.com',
      'tok-123',
      'file-1',
    );
    expect(exportPenpotComponent).toHaveBeenCalledTimes(2);
    expect(specs).toHaveLength(2);
  });

  it('loadAll filters to specific componentIds when provided', async () => {
    const components = [
      { id: 'comp-1', name: 'Button', type: 'component' },
      { id: 'comp-2', name: 'Card', type: 'component' },
      { id: 'comp-3', name: 'Modal', type: 'component' },
    ];
    getPenpotFileComponents.mockResolvedValue(components);
    exportPenpotComponent.mockResolvedValue(Buffer.from('png-data'));

    const adapter = new PenpotAdapter();
    const specs = await adapter.loadAll({
      ...baseConfig,
      componentIds: ['comp-1', 'comp-3'],
    });

    // Should only export comp-1 and comp-3
    expect(exportPenpotComponent).toHaveBeenCalledTimes(2);
    expect(specs).toHaveLength(2);
    const names = specs.map((s) => s.metadata.componentName);
    expect(names).toContain('Button');
    expect(names).toContain('Modal');
    expect(names).not.toContain('Card');
  });

  it('loadAll skips components with null export (best-effort)', async () => {
    const components = [
      { id: 'comp-1', name: 'Button', type: 'component' },
      { id: 'comp-2', name: 'Card', type: 'component' },
    ];
    getPenpotFileComponents.mockResolvedValue(components);
    exportPenpotComponent
      .mockResolvedValueOnce(Buffer.from('png-button'))
      .mockResolvedValueOnce(null); // export failure

    const adapter = new PenpotAdapter();
    const specs = await adapter.loadAll(baseConfig);

    expect(exportPenpotComponent).toHaveBeenCalledTimes(2);
    expect(specs).toHaveLength(1);
    expect(specs[0].metadata.componentName).toBe('Button');
  });

  it('loadAll returns DesignSpec[] with correct sourceType, metadata, referenceImage', async () => {
    const components = [
      { id: 'comp-1', name: 'Button', type: 'component' },
    ];
    getPenpotFileComponents.mockResolvedValue(components);
    exportPenpotComponent.mockResolvedValue(Buffer.from('png-data'));

    const adapter = new PenpotAdapter();
    const specs = await adapter.loadAll(baseConfig);

    expect(specs).toHaveLength(1);
    const spec = specs[0];
    expect(spec.sourceType).toBe('penpot');
    expect(spec.referenceImage).toBeInstanceOf(Buffer);
    expect(spec.metadata.penpotComponentId).toBe('comp-1');
    expect(spec.metadata.componentName).toBe('Button');
    expect(spec.metadata.capturedAt).toBeDefined();
  });

  it('load returns first spec', async () => {
    const components = [
      { id: 'comp-1', name: 'Button', type: 'component' },
      { id: 'comp-2', name: 'Card', type: 'component' },
    ];
    getPenpotFileComponents.mockResolvedValue(components);
    exportPenpotComponent.mockResolvedValue(Buffer.from('png-data'));

    const adapter = new PenpotAdapter();
    const spec = await adapter.load(baseConfig);

    expect(spec).toBeDefined();
    expect(spec.sourceType).toBe('penpot');
  });

  it('load throws when all exports fail (empty result)', async () => {
    const components = [
      { id: 'comp-1', name: 'Button', type: 'component' },
    ];
    getPenpotFileComponents.mockResolvedValue(components);
    exportPenpotComponent.mockResolvedValue(null);

    const adapter = new PenpotAdapter();
    await expect(adapter.load(baseConfig)).rejects.toThrow(
      /No Penpot components could be exported/,
    );
  });

  it('handles getPenpotFileComponents returning empty array', async () => {
    getPenpotFileComponents.mockResolvedValue([]);

    const adapter = new PenpotAdapter();
    const specs = await adapter.loadAll(baseConfig);

    expect(specs).toEqual([]);
    expect(exportPenpotComponent).not.toHaveBeenCalled();
  });

  it('handles getPenpotFileComponents rejection', async () => {
    getPenpotFileComponents.mockRejectedValue(new Error('Penpot RPC get-file failed: 500'));

    const adapter = new PenpotAdapter();
    await expect(adapter.loadAll(baseConfig)).rejects.toThrow(
      /Penpot RPC get-file failed/,
    );
  });
});
