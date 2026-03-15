import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { createSqliteDb, type SqliteDb, sqliteSchema } from '../src/index.js';

const {
  captureRuns,
  snapshots,
  components,
} = sqliteSchema;

const FAKE_PROJECT_ID = '00000000-0000-0000-0000-000000000000';
const FAKE_RUN_ID = '00000000-0000-0000-0000-000000000000';

let db: SqliteDb;
let tempDir: string;

describe('Foreign key constraints (SQLite)', () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-db-constraints-'));
    db = createSqliteDb(join(tempDir, 'test.db'));
  });

  afterAll(async () => {
    try { await rm(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('rejects captureRun with non-existent projectId', () => {
    expect(() =>
      db.insert(captureRuns).values({
        projectId: FAKE_PROJECT_ID,
        status: 'pending',
      }).returning().all(),
    ).toThrow();
  });

  it('rejects snapshot with non-existent runId', () => {
    expect(() =>
      db.insert(snapshots).values({
        runId: FAKE_RUN_ID,
        url: 'https://example.com',
        viewport: '1920x1080',
        browser: 'chromium',
        s3Key: 'fake/key.png',
      }).returning().all(),
    ).toThrow();
  });

  it('rejects component with non-existent projectId', () => {
    expect(() =>
      db.insert(components).values({
        projectId: FAKE_PROJECT_ID,
        name: 'fake-component',
        selector: '.fake',
      }).returning().all(),
    ).toThrow();
  });
});
