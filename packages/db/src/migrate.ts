import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

/**
 * Resolves the migrations folder relative to this file.
 * In source:  src/migrations/
 * In dist:    dist/migrations/ (migrations must be copied to dist during build)
 *
 * For simplicity and test compatibility, we resolve relative to the package root
 * by going 2 levels up from __dirname (src/ -> package root) then into src/migrations/.
 */
function getMigrationsFolder(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  // thisDir is either packages/db/src (during vitest/ts-node) or packages/db/dist (compiled)
  // migrations always live in packages/db/src/migrations
  const isInDist = thisDir.endsWith('dist') || thisDir.endsWith('dist/');
  const packageRoot = isInDist
    ? join(thisDir, '..')
    : join(thisDir, '..');
  return join(packageRoot, 'src', 'migrations');
}

export async function runMigrations(connectionString: string): Promise<void> {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: getMigrationsFolder() });
  await client.end();
}
