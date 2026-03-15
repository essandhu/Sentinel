import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import Database from 'better-sqlite3';
import { createSqliteDb, type SqliteDb, sqliteSchema } from '../src/index.js';

const { projects } = sqliteSchema;

let db: SqliteDb;
let tempDir: string;
let dbPath: string;

describe('SQLite auto-creation', () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-db-migrations-'));
    dbPath = join(tempDir, 'test.db');
    db = createSqliteDb(dbPath);
  });

  afterAll(async () => {
    try { await rm(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('creates all expected tables', () => {
    const sqlite = new Database(dbPath, { readonly: true });
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    sqlite.close();

    const tableNames = tables.map((t) => t.name);

    const expectedTables = [
      'a11y_violations',
      'approval_decisions',
      'baselines',
      'breakpoint_presets',
      'capture_runs',
      'classification_overrides',
      'components',
      'design_sources',
      'diff_classifications',
      'diff_regions',
      'diff_reports',
      'environment_diffs',
      'health_scores',
      'layout_shifts',
      'lighthouse_scores',
      'performance_budgets',
      'projects',
      'snapshots',
      'test_plan_runs',
      'test_suites',
    ];

    for (const table of expectedTables) {
      expect(tableNames, `missing table: ${table}`).toContain(table);
    }
  });

  it('tables have TEXT primary keys', () => {
    const sqlite = new Database(dbPath, { readonly: true });

    // Check projects table has TEXT id column
    const columns = sqlite
      .prepare("PRAGMA table_info('projects')")
      .all() as { name: string; type: string; pk: number }[];
    sqlite.close();

    const idCol = columns.find((c) => c.name === 'id');
    expect(idCol).toBeDefined();
    expect(idCol!.type).toBe('TEXT');
    expect(idCol!.pk).toBe(1);
  });

  it('can insert and select from projects table', () => {
    const inserted = db
      .insert(projects)
      .values({ name: 'test-project' })
      .returning().all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].name).toBe('test-project');
    expect(inserted[0].id).toBeDefined();
    expect(inserted[0].createdAt).toBeDefined();
  });
});
