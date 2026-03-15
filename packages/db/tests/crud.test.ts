import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { createSqliteDb, type SqliteDb, sqliteSchema } from '../src/index.js';

const {
  projects,
  components,
  captureRuns,
} = sqliteSchema;

let db: SqliteDb;
let tempDir: string;
let projectId: string;

describe('CRUD operations (SQLite)', () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-db-crud-'));
    db = createSqliteDb(join(tempDir, 'test.db'));

    // Seed a project for FK references
    const [project] = db
      .insert(projects)
      .values({ name: 'crud-test-project' })
      .returning().all();
    projectId = project.id;
  });

  afterAll(async () => {
    try { await rm(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('creates and reads a component', () => {
    const [inserted] = db
      .insert(components)
      .values({
        projectId,
        name: 'Header',
        selector: '#main-header',
        description: 'Top navigation header',
      })
      .returning().all();

    expect(inserted.id).toBeDefined();
    expect(inserted.name).toBe('Header');
    expect(inserted.selector).toBe('#main-header');
    expect(inserted.description).toBe('Top navigation header');
    expect(inserted.projectId).toBe(projectId);

    const [found] = db
      .select()
      .from(components)
      .where(eq(components.id, inserted.id)).all();

    expect(found).toBeDefined();
    expect(found.name).toBe('Header');
    expect(found.selector).toBe('#main-header');
    expect(found.description).toBe('Top navigation header');

    // Clean up for isolation
    db.delete(components).where(eq(components.id, inserted.id)).run();
  });

  it('updates a capture run status', () => {
    const [inserted] = db
      .insert(captureRuns)
      .values({
        projectId,
        status: 'pending',
      })
      .returning().all();

    expect(inserted.status).toBe('pending');
    expect(inserted.completedAt).toBeNull();

    const completedAt = new Date();
    db
      .update(captureRuns)
      .set({ status: 'completed', completedAt })
      .where(eq(captureRuns.id, inserted.id))
      .run();

    const [updated] = db
      .select()
      .from(captureRuns)
      .where(eq(captureRuns.id, inserted.id)).all();

    expect(updated.status).toBe('completed');
    expect(updated.completedAt).toBeDefined();

    // Clean up for isolation
    db.delete(captureRuns).where(eq(captureRuns.id, inserted.id)).run();
  });

  it('deletes a component', () => {
    const [inserted] = db
      .insert(components)
      .values({
        projectId,
        name: 'DeleteMe',
        selector: '.delete-target',
      })
      .returning().all();

    expect(inserted.id).toBeDefined();

    db.delete(components).where(eq(components.id, inserted.id)).run();

    const rows = db
      .select()
      .from(components)
      .where(eq(components.id, inserted.id)).all();

    expect(rows).toHaveLength(0);
  });
});
