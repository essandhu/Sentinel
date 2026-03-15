import { describe, it, expect, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { ImageBaselineAdapter } from './image-adapter.js';

// Minimal valid 1x1 PNG (67 bytes)
const MINIMAL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR length + type
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color type
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT length + type
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, // IDAT data
  0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, // IDAT CRC
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND length + type
  0x44, 0xae, 0x42, 0x60, 0x82, // IEND CRC
]);

describe('ImageBaselineAdapter', () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  async function createTempDir(): Promise<string> {
    const dir = join(tmpdir(), `sentinel-test-${randomUUID()}`);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async function writePng(filePath: string): Promise<void> {
    await mkdir(join(filePath, '..'), { recursive: true });
    await writeFile(filePath, MINIMAL_PNG);
  }

  it('returns 3 DesignSpecs for a directory with 3 PNG files', async () => {
    tempDir = await createTempDir();
    await writePng(join(tempDir, 'Button.png'));
    await writePng(join(tempDir, 'Card.png'));
    await writePng(join(tempDir, 'Modal.png'));

    const adapter = new ImageBaselineAdapter();
    const specs = await adapter.loadAll({ directory: tempDir });

    expect(specs).toHaveLength(3);
    for (const spec of specs) {
      expect(spec.sourceType).toBe('image');
      expect(spec.referenceImage).toBeInstanceOf(Buffer);
      expect(spec.referenceImage!.length).toBeGreaterThan(0);
      expect(spec.metadata.componentName).toBeDefined();
    }
  });

  it('derives componentName from relative path without extension', async () => {
    tempDir = await createTempDir();
    await writePng(join(tempDir, 'Button.png'));

    const adapter = new ImageBaselineAdapter();
    const specs = await adapter.loadAll({ directory: tempDir });

    expect(specs[0].metadata.componentName).toBe('Button');
  });

  it('handles nested paths and normalizes to forward slashes', async () => {
    tempDir = await createTempDir();
    await writePng(join(tempDir, 'sub', 'Component', 'state.png'));

    const adapter = new ImageBaselineAdapter();
    const specs = await adapter.loadAll({ directory: tempDir });

    expect(specs[0].metadata.componentName).toBe('sub/Component/state');
  });

  it('returns empty array for empty directory', async () => {
    tempDir = await createTempDir();

    const adapter = new ImageBaselineAdapter();
    const specs = await adapter.loadAll({ directory: tempDir });

    expect(specs).toHaveLength(0);
  });

  it('load() returns the first DesignSpec from the directory', async () => {
    tempDir = await createTempDir();
    await writePng(join(tempDir, 'Alpha.png'));
    await writePng(join(tempDir, 'Beta.png'));

    const adapter = new ImageBaselineAdapter();
    const spec = await adapter.load({ directory: tempDir });

    expect(spec.sourceType).toBe('image');
    expect(spec.referenceImage).toBeInstanceOf(Buffer);
    expect(spec.metadata.componentName).toBeDefined();
  });

  it('load() throws when directory has no PNG files', async () => {
    tempDir = await createTempDir();

    const adapter = new ImageBaselineAdapter();

    await expect(adapter.load({ directory: tempDir })).rejects.toThrow(
      /no png files found/i
    );
  });
});
