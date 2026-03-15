import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { createSqliteDb, type SqliteDb } from '@sentinel/db';
import { FilesystemStorageAdapter, type StorageAdapter } from '@sentinel/storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Temp directory root for E2E test data. */
let tempDir: string | undefined;

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

/** Create a temporary directory for the test run. */
async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'sentinel-e2e-'));
}

/** Return a Drizzle SQLite database client backed by a temp file. */
export function getDb(dir: string): SqliteDb {
  const dbPath = join(dir, 'sentinel-e2e.db');
  return createSqliteDb(dbPath);
}

/** Return a FilesystemStorageAdapter backed by a temp directory. */
export function getStorage(dir: string): StorageAdapter {
  return new FilesystemStorageAdapter(join(dir, 'storage'));
}

// ---------------------------------------------------------------------------
// Combined infrastructure setup
// ---------------------------------------------------------------------------

export interface E2eInfra {
  db: SqliteDb;
  storage: StorageAdapter;
  tempDir: string;
}

/**
 * Create a fresh SQLite database and filesystem storage in a temp directory.
 * Tables are auto-created by `createSqliteDb`. Intended for `beforeAll`.
 */
export async function setupE2eInfra(): Promise<E2eInfra> {
  const dir = await createTempDir();
  tempDir = dir;

  const db = getDb(dir);
  const storage = getStorage(dir);
  await storage.ensureReady();

  return { db, storage, tempDir: dir };
}

/**
 * Remove the temp directory and all test data. Intended for `afterAll`.
 */
export async function teardownE2eInfra(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup — temp dir will be reclaimed by OS
  }
}
