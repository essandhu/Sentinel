import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { eq } from 'drizzle-orm';
import { initLocalRuntime } from '../local-runtime.js';

describe('Local mode integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-int-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('initializes runtime with empty database', async () => {
    const runtime = await initLocalRuntime(tempDir);
    try {
      const { projects } = await import('@sentinel/db').then(m => m.sqliteSchema);
      const result = runtime.db.select().from(projects).all();
      expect(result).toHaveLength(0);
    } finally {
      runtime.close();
    }
  });

  it('can create a project and capture run', async () => {
    const runtime = await initLocalRuntime(tempDir);
    try {
      const { projects, captureRuns } = await import('@sentinel/db').then(m => m.sqliteSchema);

      runtime.db.insert(projects).values({
        id: 'test-project',
        name: 'Test Project',
        createdAt: new Date(),
      }).run();

      runtime.db.insert(captureRuns).values({
        id: 'test-run',
        projectId: 'test-project',
        status: 'pending',
        branchName: 'main',
        source: 'manual',
        createdAt: new Date(),
      }).run();

      const [run] = runtime.db.select().from(captureRuns)
        .where(eq(captureRuns.id, 'test-run')).all();
      expect(run).toBeDefined();
      expect(run.status).toBe('pending');
      expect(run.branchName).toBe('main');
    } finally {
      runtime.close();
    }
  });

  it('storage round-trips files correctly', async () => {
    const runtime = await initLocalRuntime(tempDir);
    try {
      const buf = Buffer.from('test-image-data');
      await runtime.storage.upload('captures/r1/s1.png', buf);

      const downloaded = await runtime.storage.download('captures/r1/s1.png');
      expect(downloaded.toString()).toBe('test-image-data');

      expect(await runtime.storage.exists('captures/r1/s1.png')).toBe(true);
      expect(await runtime.storage.exists('nonexistent.png')).toBe(false);
    } finally {
      runtime.close();
    }
  });

  it('database is persistent across runtime instances', async () => {
    const { projects } = await import('@sentinel/db').then(m => m.sqliteSchema);

    // First runtime - create data
    const r1 = await initLocalRuntime(tempDir);
    try {
      r1.db.insert(projects).values({
        id: 'persist-test',
        name: 'Persistent',
        createdAt: new Date(),
      }).run();
    } finally {
      r1.close();
    }

    // Second runtime - data should still be there
    const r2 = await initLocalRuntime(tempDir);
    try {
      const [project] = r2.db.select().from(projects)
        .where(eq(projects.id, 'persist-test')).all();
      expect(project).toBeDefined();
      expect(project.name).toBe('Persistent');
    } finally {
      r2.close();
    }
  });

  it('.sentinel directory structure is correct', async () => {
    const runtime = await initLocalRuntime(tempDir);
    try {
      const sentinelDir = join(tempDir, '.sentinel');
      const dbPath = join(sentinelDir, 'sentinel.db');

      const dirStat = await stat(sentinelDir);
      expect(dirStat.isDirectory()).toBe(true);

      const dbStat = await stat(dbPath);
      expect(dbStat.isFile()).toBe(true);
    } finally {
      runtime.close();
    }
  });
});
