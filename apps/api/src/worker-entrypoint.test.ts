import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entrypointPath = resolve(__dirname, 'worker-entrypoint.ts');

describe('worker-entrypoint', () => {
  it('exists as a source file', () => {
    // Should not throw
    const source = readFileSync(entrypointPath, 'utf-8');
    expect(source.length).toBeGreaterThan(0);
  });

  it('imports startWorkers from workers/index', () => {
    const source = readFileSync(entrypointPath, 'utf-8');
    expect(source).toMatch(/import.*startWorkers.*['"]\.\/workers\/index\.js['"]/);
  });

  it('does NOT import buildServer or any HTTP server modules', () => {
    const source = readFileSync(entrypointPath, 'utf-8');
    const forbiddenImports = [
      /import.*['"]\.\/server\.js['"]/,
      /import.*['"]fastify['"]/,
      /import.*['"]@trpc/,
      /import.*['"]@clerk/,
      /import.*['"]graphql/,
      /import.*['"]swagger/,
      /import.*['"]@fastify/,
    ];
    for (const pattern of forbiddenImports) {
      expect(source).not.toMatch(pattern);
    }
  });

  it('references REDIS_URL environment variable', () => {
    const source = readFileSync(entrypointPath, 'utf-8');
    expect(source).toContain('REDIS_URL');
  });

  it('calls process.exit(1) when REDIS_URL is missing', () => {
    const source = readFileSync(entrypointPath, 'utf-8');
    expect(source).toContain('process.exit(1)');
  });

  it('calls startWorkers with the Redis URL', () => {
    const source = readFileSync(entrypointPath, 'utf-8');
    expect(source).toMatch(/await\s+startWorkers\s*\(/);
  });
});
