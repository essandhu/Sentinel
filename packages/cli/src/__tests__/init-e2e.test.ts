import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { parse as parseYaml } from 'yaml';
import { generateConfig } from '../commands/init.js';

describe('init command e2e', () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('creates a sentinel.config.yaml in the target directory', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-init-'));

    const yaml = generateConfig({
      baseUrl: 'http://localhost:3000',
      routes: ['/', '/about'],
      projectName: 'test-project',
    });

    const configPath = join(tempDir, 'sentinel.config.yml');
    const { writeFile } = await import('fs/promises');
    await writeFile(configPath, yaml, 'utf-8');

    const contents = await readFile(configPath, 'utf-8');
    expect(contents).toBeTruthy();
    expect(contents.length).toBeGreaterThan(0);
  });

  it('generated config contains required fields (project, capture, routes, viewports)', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-init-'));

    const yaml = generateConfig({
      baseUrl: 'http://localhost:4000',
      routes: ['/', '/dashboard', '/settings'],
      projectName: 'my-app',
    });

    const configPath = join(tempDir, 'sentinel.config.yml');
    const { writeFile } = await import('fs/promises');
    await writeFile(configPath, yaml, 'utf-8');

    const contents = await readFile(configPath, 'utf-8');
    const parsed = parseYaml(contents);

    // Required field: project
    expect(parsed.project).toBe('my-app');

    // Required field: capture
    expect(parsed.capture).toBeDefined();

    // Required field: capture.routes
    expect(parsed.capture.routes).toBeDefined();
    expect(Array.isArray(parsed.capture.routes)).toBe(true);
    expect(parsed.capture.routes.length).toBe(3);
    expect(parsed.capture.routes[0].path).toBe('/');
    expect(parsed.capture.routes[1].path).toBe('/dashboard');
    expect(parsed.capture.routes[2].path).toBe('/settings');

    // Required field: capture.viewports
    expect(parsed.capture.viewports).toBeDefined();
    expect(Array.isArray(parsed.capture.viewports)).toBe(true);
    expect(parsed.capture.viewports.length).toBeGreaterThan(0);
  });

  it('generates config with correct baseUrl', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-init-'));

    const yaml = generateConfig({
      baseUrl: 'http://localhost:8080',
      routes: ['/'],
      projectName: 'custom-port-app',
    });

    const parsed = parseYaml(yaml);

    expect(parsed.baseUrl).toBe('http://localhost:8080');
  });

  it('normalizes route paths with leading slash', async () => {
    const yaml = generateConfig({
      baseUrl: 'http://localhost:3000',
      routes: ['about', '/contact'],
      projectName: 'normalize-test',
    });

    const parsed = parseYaml(yaml);

    // 'about' should get a leading slash
    expect(parsed.capture.routes[0].path).toBe('/about');
    // '/contact' should stay as-is
    expect(parsed.capture.routes[1].path).toBe('/contact');
  });
});
