import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createSqliteDb, type SqliteDb } from '@sentinel-vrt/db';
import { FilesystemStorageAdapter } from '@sentinel-vrt/storage';

export interface LocalRuntime {
  db: SqliteDb;
  storage: FilesystemStorageAdapter;
  sentinelDir: string;
  dbPath: string;
  /** Close the underlying SQLite connection (releases file locks). */
  close(): void;
}

/**
 * Initialise the local Sentinel runtime: creates the `.sentinel/` directory,
 * opens (or creates) the SQLite database, and prepares the filesystem storage.
 */
export async function initLocalRuntime(projectDir: string): Promise<LocalRuntime> {
  const sentinelDir = join(projectDir, '.sentinel');
  await mkdir(sentinelDir, { recursive: true });

  const dbPath = join(sentinelDir, 'sentinel.db');
  const db = createSqliteDb(dbPath);

  const storage = new FilesystemStorageAdapter(sentinelDir);
  await storage.ensureReady();

  return {
    db,
    storage,
    sentinelDir,
    dbPath,
    close() {
      // drizzle-orm exposes the underlying better-sqlite3 handle via $client
      (db as any).$client?.close();
    },
  };
}
