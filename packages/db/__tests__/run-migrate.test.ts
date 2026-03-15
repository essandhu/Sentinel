import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the migrate module
const mockRunMigrations = vi.fn().mockResolvedValue(undefined);
vi.mock('../src/migrate.js', () => ({
  runMigrations: mockRunMigrations,
}));

describe('run-migrate', () => {
  const originalEnv = process.env.DATABASE_URL;
  const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit called');
  }) as any);
  const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    mockRunMigrations.mockResolvedValue(undefined);
    // Reset modules so run-migrate.ts re-executes its top-level code
    vi.resetModules();
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalEnv;
  });

  it('exits with code 1 when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL;

    await expect(async () => {
      await import('../src/run-migrate.js');
    }).rejects.toThrow('process.exit called');

    expect(mockConsoleError).toHaveBeenCalledWith('DATABASE_URL is required');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('calls runMigrations with the DATABASE_URL when set', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test_run_migrate';

    await import('../src/run-migrate.js');

    expect(mockRunMigrations).toHaveBeenCalledWith('postgresql://localhost/test_run_migrate');
  });

  it('logs success message after migrations complete', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test_run_migrate';

    await import('../src/run-migrate.js');

    expect(mockConsoleLog).toHaveBeenCalledWith('Database migrations complete');
  });
});
