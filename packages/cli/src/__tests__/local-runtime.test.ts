import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initLocalRuntime, type LocalRuntime } from '../local-runtime.js';

describe('initLocalRuntime', () => {
  let tempDir: string;
  const runtimes: LocalRuntime[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-cli-test-'));
  });

  afterEach(async () => {
    // Close all SQLite connections before removing temp dir (required on Windows)
    for (const rt of runtimes) {
      rt.close();
    }
    runtimes.length = 0;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates .sentinel directory with db and storage', async () => {
    const runtime = await initLocalRuntime(tempDir);
    runtimes.push(runtime);

    expect(runtime.db).toBeDefined();
    expect(runtime.storage).toBeDefined();
    expect(runtime.sentinelDir).toBe(join(tempDir, '.sentinel'));

    const dbStat = await stat(runtime.dbPath);
    expect(dbStat.isFile()).toBe(true);
  });

  it('is idempotent', async () => {
    const r1 = await initLocalRuntime(tempDir);
    runtimes.push(r1);
    // Close the first connection before opening a second to the same file
    r1.close();

    const r2 = await initLocalRuntime(tempDir);
    runtimes.push(r2);

    expect(r2.sentinelDir).toBe(r1.sentinelDir);
  });
});
