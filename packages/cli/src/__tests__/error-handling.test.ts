import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Mock @sentinel-vrt/capture
vi.mock('@sentinel-vrt/capture', () => ({
  loadConfig: vi.fn(),
  processCaptureLocal: vi.fn().mockResolvedValue(undefined),
}));

// Mock @sentinel-vrt/db
const mockInsertReturning = vi.fn();
const mockSelectWhere = vi.fn();

const mockDb = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: mockInsertReturning,
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: mockSelectWhere,
  innerJoin: vi.fn().mockReturnThis(),
  orderBy: vi.fn(),
  run: vi.fn(),
  all: vi.fn(),
};

vi.mock('@sentinel-vrt/db', () => ({
  createSqliteDb: vi.fn(() => mockDb),
  sqliteSchema: {
    projects: { name: 'projects' },
    captureRuns: { name: 'captureRuns' },
    snapshots: { name: 'snapshots' },
    diffReports: { name: 'diffReports' },
    lighthouseScores: { name: 'lighthouseScores' },
    testPlanRuns: { name: 'testPlanRuns' },
  },
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, val) => ({ field, val })),
  and: vi.fn((...args) => ({ and: args })),
  gte: vi.fn((field, val) => ({ gte: { field, val } })),
  asc: vi.fn((field) => ({ asc: field })),
}));

// Mock @sentinel-vrt/storage
const mockStorage = { ensureReady: vi.fn().mockResolvedValue(undefined) };
vi.mock('@sentinel-vrt/storage', () => ({
  FilesystemStorageAdapter: vi.fn(function () { return mockStorage; }),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { runCapture } from '../commands/capture-local.js';
import { loadConfig, processCaptureLocal } from '@sentinel-vrt/capture';

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('capture error handling', () => {
  const DEFAULT_OPTIONS = {
    config: 'sentinel.config.yml',
    commitSha: 'abc123',
    branch: 'main',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENTINEL_DIR = '/tmp/sentinel-test';
  });

  it('throws when config file is not found (loadConfig rejects)', async () => {
    vi.mocked(loadConfig).mockRejectedValue(
      new Error('Config file not found: sentinel.config.yml'),
    );

    await expect(runCapture(DEFAULT_OPTIONS)).rejects.toThrow(
      /config file not found/i,
    );
  });

  it('throws when capture processing fails (processCaptureLocal rejects)', async () => {
    vi.mocked(loadConfig).mockResolvedValue({
      project: 'my-project',
      baseUrl: 'http://localhost:3000',
      capture: {
        routes: [{ path: '/home', name: 'home' }],
        viewports: ['1280x720'],
      },
    } as any);

    // Set up DB mocks so we get past project/captureRun creation
    let selectCallCount = 0;
    mockSelectWhere.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // project lookup - return existing project
        return { all: vi.fn(() => [{ id: 'proj-1', name: 'my-project' }]) };
      }
      return { all: vi.fn(() => []) };
    });

    mockDb.insert.mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue({
          all: vi.fn(() => [{ id: 'run-1', projectId: 'proj-1', status: 'pending' }]),
        }),
        run: vi.fn(),
      }),
    }));

    // Make processCaptureLocal fail
    vi.mocked(processCaptureLocal).mockRejectedValue(
      new Error('Browser launch failed'),
    );

    await expect(runCapture(DEFAULT_OPTIONS)).rejects.toThrow(
      /browser launch failed/i,
    );
  });
});
