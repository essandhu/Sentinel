import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so these are available in vi.mock factories
const { mockEnd, mockPostgresClient, mockDrizzleReturn, mockMigrate } = vi.hoisted(() => {
  const mockEnd = vi.fn().mockResolvedValue(undefined);
  const mockPostgresClient = Object.assign(vi.fn(), { end: mockEnd });
  const mockDrizzleReturn = { query: vi.fn() };
  const mockMigrate = vi.fn().mockResolvedValue(undefined);
  return { mockEnd, mockPostgresClient, mockDrizzleReturn, mockMigrate };
});

vi.mock('postgres', () => ({
  default: vi.fn(() => mockPostgresClient),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => mockDrizzleReturn),
}));

vi.mock('drizzle-orm/postgres-js/migrator', () => ({
  migrate: mockMigrate,
}));

// Import after mocks
import { runMigrations } from '../src/migrate.js';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

describe('migrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnd.mockResolvedValue(undefined);
    mockMigrate.mockResolvedValue(undefined);
  });

  describe('runMigrations', () => {
    it('creates a postgres client with max: 1 connection', async () => {
      await runMigrations('postgresql://localhost/testdb');

      expect(postgres).toHaveBeenCalledWith('postgresql://localhost/testdb', { max: 1 });
    });

    it('creates a drizzle instance from the postgres client', async () => {
      await runMigrations('postgresql://localhost/testdb');

      expect(drizzle).toHaveBeenCalledWith(mockPostgresClient);
    });

    it('calls migrate with the drizzle instance and migrations folder', async () => {
      await runMigrations('postgresql://localhost/testdb');

      expect(migrate).toHaveBeenCalledTimes(1);
      expect(migrate).toHaveBeenCalledWith(mockDrizzleReturn, {
        migrationsFolder: expect.stringContaining('migrations'),
      });
    });

    it('migrations folder path ends with src/migrations', async () => {
      await runMigrations('postgresql://localhost/testdb');

      const migrationsArg = mockMigrate.mock.calls[0][1];
      const folder = migrationsArg.migrationsFolder.replace(/\\/g, '/');
      expect(folder).toMatch(/src\/migrations$/);
    });

    it('closes the postgres client after migration completes', async () => {
      await runMigrations('postgresql://localhost/testdb');

      expect(mockEnd).toHaveBeenCalledTimes(1);
    });

    it('calls end after migrate (ordering)', async () => {
      const callOrder: string[] = [];
      mockMigrate.mockImplementation(async () => {
        callOrder.push('migrate');
      });
      mockEnd.mockImplementation(async () => {
        callOrder.push('end');
      });

      await runMigrations('postgresql://localhost/testdb');

      expect(callOrder).toEqual(['migrate', 'end']);
    });

    it('propagates errors from migrate', async () => {
      const migrationError = new Error('migration failed');
      mockMigrate.mockRejectedValueOnce(migrationError);

      await expect(runMigrations('postgresql://localhost/testdb')).rejects.toThrow(
        'migration failed',
      );
    });

    it('uses the exact connection string passed as argument', async () => {
      const customUrl = 'postgresql://admin:secret@db.example.com:5433/prod';
      await runMigrations(customUrl);

      expect(postgres).toHaveBeenCalledWith(customUrl, { max: 1 });
    });
  });
});
