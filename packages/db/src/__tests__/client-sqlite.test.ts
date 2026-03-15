import { describe, it, expect, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteDb } from '../client-sqlite.js';
import { projects, captureRuns } from '../schema-sqlite.js';
import { eq } from 'drizzle-orm';

describe('createSqliteDb', () => {
  const testDbPath = join(tmpdir(), `sentinel-test-${Date.now()}.db`);

  afterEach(() => {
    try { unlinkSync(testDbPath); } catch {}
    try { unlinkSync(testDbPath + '-wal'); } catch {}
    try { unlinkSync(testDbPath + '-shm'); } catch {}
  });

  it('creates database with all tables', () => {
    const db = createSqliteDb(testDbPath);
    expect(existsSync(testDbPath)).toBe(true);
    // Query projects table - should return empty array
    const result = db.select().from(projects).all();
    expect(result).toHaveLength(0);
  });

  it('can insert and query records', () => {
    const db = createSqliteDb(testDbPath);
    db.insert(projects).values({
      id: 'test-1',
      name: 'Test Project',
      createdAt: new Date(),
    }).run();

    const [p] = db.select().from(projects).where(eq(projects.id, 'test-1')).all();
    expect(p.name).toBe('Test Project');
  });

  it('is idempotent (second call on same db works)', () => {
    const db1 = createSqliteDb(testDbPath);
    db1.insert(projects).values({ id: 'p1', name: 'P1', createdAt: new Date() }).run();

    // Re-open same DB
    const db2 = createSqliteDb(testDbPath);
    const [p] = db2.select().from(projects).where(eq(projects.id, 'p1')).all();
    expect(p.name).toBe('P1');
  });
});
