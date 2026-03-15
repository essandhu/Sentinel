import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock postgres client
const mockPostgresClient = { end: vi.fn() };
vi.mock('postgres', () => ({
  default: vi.fn(() => mockPostgresClient),
}));

// Mock drizzle-orm/postgres-js
const mockDrizzleReturn = { query: vi.fn() };
vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => mockDrizzleReturn),
}));

// Import after mocks
import { createDb } from '../src/client.js';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/schema.js';

describe('client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDb', () => {
    it('creates a postgres client with the provided connection string', () => {
      const connString = 'postgresql://user:pass@localhost:5432/testdb';
      createDb(connString);

      expect(postgres).toHaveBeenCalledWith(connString);
    });

    it('passes the postgres client and schema to drizzle', () => {
      const connString = 'postgresql://user:pass@localhost:5432/testdb';
      createDb(connString);

      expect(drizzle).toHaveBeenCalledWith(mockPostgresClient, { schema });
    });

    it('returns the drizzle instance', () => {
      const result = createDb('postgresql://localhost/test');

      expect(result).toBe(mockDrizzleReturn);
    });

    it('falls back to DATABASE_URL env var when no argument is provided', () => {
      const original = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://env-var@localhost:5432/envdb';

      createDb();

      expect(postgres).toHaveBeenCalledWith('postgresql://env-var@localhost:5432/envdb');

      process.env.DATABASE_URL = original;
    });

    it('creates a new client on each call (no singleton)', () => {
      createDb('postgresql://localhost/db1');
      createDb('postgresql://localhost/db2');

      expect(postgres).toHaveBeenCalledTimes(2);
      expect(drizzle).toHaveBeenCalledTimes(2);
    });
  });
});
