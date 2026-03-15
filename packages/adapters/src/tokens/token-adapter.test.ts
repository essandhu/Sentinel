import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DesignTokenAdapter } from './token-adapter.js';
import type { DesignTokenAdapterConfig } from '../types.js';

/**
 * Creates a temp file with the given content and returns its path.
 */
async function writeTempFile(dir: string, name: string, content: string): Promise<string> {
  const filePath = join(dir, name);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('DesignTokenAdapter', () => {
  let tmpDir: string;
  const adapter = new DesignTokenAdapter();

  // Set up a fresh temp directory for each test
  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  describe('adapter name', () => {
    it('has the name "design-tokens"', () => {
      expect(adapter.name).toBe('design-tokens');
    });
  });

  describe('basic JSON token parsing', () => {
    it('returns DesignSpec with sourceType "tokens"', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        color: {
          $type: 'color',
          primary: { $value: '#0066cc' },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.sourceType).toBe('tokens');
    });

    it('returns tokens record from a simple DTCG file', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        color: {
          $type: 'color',
          primary: { $value: '#0066cc' },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.tokens).toBeDefined();
      expect(spec.tokens!['color.primary']).toMatchObject({ type: 'color', value: '#0066cc' });
    });

    it('includes capturedAt in metadata', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        spacing: { small: { $type: 'dimension', $value: '8px' } },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.metadata.capturedAt).toBeDefined();
    });
  });

  describe('token tree flattening', () => {
    it('flattens nested token tree using dot notation', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        color: {
          $type: 'color',
          brand: {
            primary: { $value: '#0066cc' },
            secondary: { $value: '#ff6600' },
          },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.tokens!['color.brand.primary']).toMatchObject({ type: 'color', value: '#0066cc' });
      expect(spec.tokens!['color.brand.secondary']).toMatchObject({ type: 'color', value: '#ff6600' });
    });

    it('inherits group-level $type to children without their own $type', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        color: {
          $type: 'color',
          primary: { $value: '#0066cc' },
          secondary: { $value: '#ff6600' },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.tokens!['color.primary'].type).toBe('color');
      expect(spec.tokens!['color.secondary'].type).toBe('color');
    });

    it('child $type overrides parent $type', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        spacing: {
          $type: 'dimension',
          gap: {
            $type: 'number',
            small: { $value: 8 },
          },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.tokens!['spacing.gap.small'].type).toBe('number');
    });

    it('falls back to "unknown" type when no $type is provided', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        mystery: { $value: 'some-value' },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.tokens!['mystery'].type).toBe('unknown');
    });

    it('skips $description, $extensions, $deprecated keys (not treated as groups)', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        $description: 'Token collection description',
        color: {
          $type: 'color',
          $description: 'Brand colors',
          $extensions: { 'com.example': {} },
          primary: { $value: '#0066cc', $deprecated: true },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      // $description, $extensions, $deprecated should not create tokens
      const keys = Object.keys(spec.tokens ?? {});
      expect(keys).not.toContain('$description');
      expect(keys).not.toContain('color.$description');
      expect(keys).not.toContain('color.$extensions');
      // The $deprecated is on a token, not a group, so the token itself is still included
      expect(keys).toContain('color.primary');
    });
  });

  describe('color normalization', () => {
    it('normalizes color token string values to hex', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        color: {
          $type: 'color',
          blue: { $value: 'rgb(0, 102, 204)' },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.tokens!['color.blue'].value).toBe('#0066cc');
    });

    it('normalizes DTCG structured color $value to hex', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        color: {
          $type: 'color',
          blue: { $value: { colorSpace: 'srgb', components: [0, 0.4, 0.8] } },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.tokens!['color.blue'].value).toBe('#0066cc');
    });

    it('does not normalize non-color token values', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        spacing: {
          $type: 'dimension',
          small: { $value: '8px' },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.tokens!['spacing.small'].value).toBe('8px');
    });
  });

  describe('alias resolution', () => {
    it('resolves simple alias {dotted.path} to the referenced value', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        color: {
          $type: 'color',
          primary: { $value: '#0066cc' },
          cta: { $value: '{color.primary}' },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.tokens!['color.cta'].value).toBe('#0066cc');
    });

    it('resolves alias chains (A -> B -> C)', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        color: {
          $type: 'color',
          base: { $value: '#0066cc' },
          alias1: { $value: '{color.base}' },
          alias2: { $value: '{color.alias1}' },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.tokens!['color.alias2'].value).toBe('#0066cc');
    });

    it('throws a descriptive error on circular aliases', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        color: {
          $type: 'color',
          a: { $value: '{color.b}' },
          b: { $value: '{color.a}' },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      await expect(adapter.load(config)).rejects.toThrow(/circular/i);
    });

    it('throws when alias target does not exist', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        color: {
          $type: 'color',
          ghost: { $value: '{color.nonexistent}' },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      await expect(adapter.load(config)).rejects.toThrow(/color\.nonexistent/);
    });
  });

  describe('YAML file support', () => {
    it('parses .yaml token files correctly', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const yaml = `color:
  $type: color
  primary:
    $value: "#0066cc"
  secondary:
    $value: "#ff6600"
`;
      const tokenFile = await writeTempFile(tmpDir, 'tokens.yaml', yaml);
      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.tokens!['color.primary']).toMatchObject({ type: 'color', value: '#0066cc' });
      expect(spec.tokens!['color.secondary']).toMatchObject({ type: 'color', value: '#ff6600' });
    });

    it('parses .yml token files correctly', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const yaml = `spacing:
  $type: dimension
  small:
    $value: 8px
`;
      const tokenFile = await writeTempFile(tmpDir, 'tokens.yml', yaml);
      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const spec = await adapter.load(config);

      expect(spec.tokens!['spacing.small']).toMatchObject({ type: 'dimension', value: '8px' });
    });
  });

  describe('loadAll()', () => {
    it('returns array with a single DesignSpec', async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'sentinel-tokens-'));
      const tokenFile = await writeTempFile(tmpDir, 'tokens.json', JSON.stringify({
        color: {
          $type: 'color',
          primary: { $value: '#0066cc' },
        },
      }));

      const config: DesignTokenAdapterConfig = { tokenFilePath: tokenFile };
      const specs = await adapter.loadAll(config);

      expect(Array.isArray(specs)).toBe(true);
      expect(specs).toHaveLength(1);
      expect(specs[0].sourceType).toBe('tokens');
    });
  });
});
