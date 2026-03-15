/**
 * Centralized Redis URL parser for BullMQ connection options.
 *
 * Handles standard redis://, TLS rediss://, auth credentials,
 * and database number extraction from a Redis connection URL.
 */

export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
  maxRetriesPerRequest: null;
}

export function parseRedisUrl(redisUrl: string): RedisConnectionOptions {
  const parsed = new URL(redisUrl);

  const options: RedisConnectionOptions = {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    maxRetriesPerRequest: null,
  };

  if (parsed.username) {
    options.username = decodeURIComponent(parsed.username);
  }

  if (parsed.password) {
    options.password = decodeURIComponent(parsed.password);
  }

  // Extract database number from pathname (e.g., /2 -> db: 2)
  const dbStr = parsed.pathname.replace(/^\//, '');
  if (dbStr) {
    const db = parseInt(dbStr, 10);
    if (!isNaN(db) && db > 0) {
      options.db = db;
    }
  }

  // Enable TLS for rediss:// protocol
  if (parsed.protocol === 'rediss:') {
    options.tls = {};
  }

  return options;
}
