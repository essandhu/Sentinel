import { describe, it, expect } from 'vitest';

// We mock postgres and drizzle so importing index.ts doesn't attempt real connections
vi.mock('postgres', () => ({
  default: vi.fn(() => ({ end: vi.fn() })),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({})),
}));

vi.mock('drizzle-orm/postgres-js/migrator', () => ({
  migrate: vi.fn(),
}));

describe('index (barrel exports)', () => {
  it('re-exports createDb from client', async () => {
    const indexModule = await import('../src/index.js');
    expect(indexModule).toHaveProperty('createDb');
    expect(typeof indexModule.createDb).toBe('function');
  });

  it('re-exports runMigrations from migrate', async () => {
    const indexModule = await import('../src/index.js');
    expect(indexModule).toHaveProperty('runMigrations');
    expect(typeof indexModule.runMigrations).toBe('function');
  });

  it('re-exports all schema tables', async () => {
    const indexModule = await import('../src/index.js');
    const expectedTables = [
      'projects',
      'captureSchedules',
      'testPlanRuns',
      'captureRuns',
      'components',
      'snapshots',
      'diffReports',
      'baselines',
      'approvalDecisions',
      'workspaceSettings',
      'adapterState',
      'notificationPreferences',
      'apiKeys',
      'healthScores',
      'a11yViolations',
      'diffClassifications',
      'diffRegions',
      'layoutShifts',
      'breakpointPresets',
      'lighthouseScores',
      'performanceBudgets',
      'testSuites',
      'classificationOverrides',
      'environments',
      'environmentDiffs',
      'approvalChainSteps',
      'approvalChainProgress',
    ];

    for (const table of expectedTables) {
      expect(indexModule).toHaveProperty(table);
    }
  });

  it('Db type is exported (type-level check via createDb return)', async () => {
    // We cannot directly test type exports at runtime, but we verify that
    // createDb is exported (Db is ReturnType<typeof createDb>).
    const indexModule = await import('../src/index.js');
    expect(indexModule.createDb).toBeDefined();
  });
});
