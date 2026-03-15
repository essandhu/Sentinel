import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parse as parseYaml } from 'yaml';

// Mock fs/promises for framework detection
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  access: vi.fn(),
}));

import { readFile } from 'fs/promises';

const mockReadFile = vi.mocked(readFile);

// Import after mocks
import { detectFramework, generateConfig } from '../commands/init.js';

describe('detectFramework', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns "next" when package.json has next dependency', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
      }),
    );

    const result = await detectFramework('/fake/dir');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('next');
  });

  it('returns "vite" when package.json has vite devDependency + react dependency', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        dependencies: { react: '^18.0.0' },
        devDependencies: { vite: '^5.0.0' },
      }),
    );

    const result = await detectFramework('/fake/dir');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('vite');
  });

  it('returns null when no recognized framework found', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        dependencies: { express: '^4.0.0' },
      }),
    );

    const result = await detectFramework('/fake/dir');
    expect(result).toBeNull();
  });
});

describe('generateConfig', () => {
  it('produces valid YAML that passes SentinelConfigSchema validation', () => {
    const yaml = generateConfig({
      baseUrl: 'http://localhost:3000',
      routes: ['/', '/about'],
      projectName: 'my-project',
    });

    // Should be valid YAML
    const parsed = parseYaml(yaml);
    expect(parsed).toBeDefined();
    expect(parsed.project).toBe('my-project');
    expect(parsed.baseUrl).toBe('http://localhost:3000');
    expect(parsed.capture.routes).toHaveLength(2);
    expect(parsed.capture.routes[0].path).toBe('/');
    expect(parsed.capture.routes[1].path).toBe('/about');
  });

  it('includes user-provided baseUrl and at least one route', () => {
    const yaml = generateConfig({
      baseUrl: 'http://localhost:8080',
      routes: ['/dashboard'],
      projectName: 'test-proj',
    });

    const parsed = parseYaml(yaml);
    expect(parsed.baseUrl).toBe('http://localhost:8080');
    expect(parsed.capture.routes.length).toBeGreaterThanOrEqual(1);
    expect(parsed.capture.routes[0].path).toBe('/dashboard');
  });
});
