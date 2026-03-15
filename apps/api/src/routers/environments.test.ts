import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ---------- Test UUIDs ----------
const PROJECT_ID = '00000000-0000-4000-a000-000000000600';
const ENV_ID = '00000000-0000-4000-a000-000000000601';

// ---------- Mock service functions ----------
const mockListEnvironments = vi.fn();
const mockCreateEnvironment = vi.fn();
const mockUpdateEnvironment = vi.fn();
const mockDeleteEnvironment = vi.fn();

vi.mock('../services/environment-service.js', () => ({
  listEnvironments: (...args: unknown[]) => mockListEnvironments(...args),
  createEnvironment: (...args: unknown[]) => mockCreateEnvironment(...args),
  updateEnvironment: (...args: unknown[]) => mockUpdateEnvironment(...args),
  deleteEnvironment: (...args: unknown[]) => mockDeleteEnvironment(...args),
}));

const mockComputeEnvironmentDiff = vi.fn();
const mockListEnvironmentRoutes = vi.fn();

vi.mock('../services/environment-diff.js', () => ({
  computeEnvironmentDiff: (...args: unknown[]) => mockComputeEnvironmentDiff(...args),
  listEnvironmentRoutes: (...args: unknown[]) => mockListEnvironmentRoutes(...args),
}));

// Mock storage
vi.mock('@sentinel/storage', () => ({
  createStorageClient: vi.fn(() => ({})),
  downloadBuffer: vi.fn(),
  uploadBuffer: vi.fn(),
}));

// Mock @sentinel/db
vi.mock('@sentinel/db', () => ({
  createDb: vi.fn(() => ({})),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  desc: vi.fn((col) => ({ _type: 'desc', col })),
}));

// Import router AFTER mocks
import { environmentsRouter } from './environments.js';
import { t } from '../trpc.js';

const createCaller = t.createCallerFactory(environmentsRouter);

describe('environmentsRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('calls listEnvironments with projectId', async () => {
      const envs = [
        { id: ENV_ID, projectId: PROJECT_ID, name: 'staging', baseUrl: 'https://staging.example.com', isReference: false },
      ];
      mockListEnvironments.mockResolvedValue(envs);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.list({ projectId: PROJECT_ID });

      expect(result).toEqual(envs);
      expect(mockListEnvironments).toHaveBeenCalledWith(
        expect.anything(), // db
        PROJECT_ID,
      );
    });
  });

  describe('create', () => {
    it('calls createEnvironment with input', async () => {
      const created = { id: ENV_ID, projectId: PROJECT_ID, name: 'dev', baseUrl: null, isReference: false };
      mockCreateEnvironment.mockResolvedValue(created);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.create({
        projectId: PROJECT_ID,
        name: 'dev',
      });

      expect(result).toEqual(created);
      expect(mockCreateEnvironment).toHaveBeenCalledWith(
        expect.anything(), // db
        { projectId: PROJECT_ID, name: 'dev' },
      );
    });
  });

  describe('update', () => {
    it('calls updateEnvironment with input', async () => {
      const updated = { id: ENV_ID, projectId: PROJECT_ID, name: 'dev', baseUrl: 'https://dev.example.com', isReference: true };
      mockUpdateEnvironment.mockResolvedValue(updated);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.update({
        id: ENV_ID,
        baseUrl: 'https://dev.example.com',
        isReference: true,
      });

      expect(result).toEqual(updated);
      expect(mockUpdateEnvironment).toHaveBeenCalledWith(
        expect.anything(), // db
        { id: ENV_ID, baseUrl: 'https://dev.example.com', isReference: true },
      );
    });
  });

  describe('delete', () => {
    it('calls deleteEnvironment with id', async () => {
      mockDeleteEnvironment.mockResolvedValue({ success: true });

      const caller = createCaller({ auth: null } as any);
      const result = await caller.delete({ id: ENV_ID });

      expect(result).toEqual({ success: true });
      expect(mockDeleteEnvironment).toHaveBeenCalledWith(
        expect.anything(), // db
        ENV_ID,
      );
    });
  });

  describe('compareDiff', () => {
    it('calls computeEnvironmentDiff with correct args including storage adapter', async () => {
      const diffResult = { mismatchPercentage: 2.5, diffImageKey: 'diff/abc.png' };
      mockComputeEnvironmentDiff.mockResolvedValue(diffResult);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.compareDiff({
        projectId: PROJECT_ID,
        sourceEnv: 'staging',
        targetEnv: 'production',
        url: '/login',
        viewport: '1280x720',
        browser: 'chromium',
      });

      expect(result).toEqual(diffResult);
      expect(mockComputeEnvironmentDiff).toHaveBeenCalledWith(
        expect.anything(), // db
        expect.objectContaining({ download: expect.any(Function), upload: expect.any(Function) }), // storageAdapter
        expect.any(String), // bucket
        {
          projectId: PROJECT_ID,
          sourceEnv: 'staging',
          targetEnv: 'production',
          url: '/login',
          viewport: '1280x720',
          browser: 'chromium',
        },
      );
    });
  });

  describe('listRoutes', () => {
    it('calls listEnvironmentRoutes with projectId and environmentName', async () => {
      const routes = [{ url: '/', viewport: '1280x720' }, { url: '/about', viewport: '1280x720' }];
      mockListEnvironmentRoutes.mockResolvedValue(routes);

      const caller = createCaller({ auth: null } as any);
      const result = await caller.listRoutes({
        projectId: PROJECT_ID,
        environmentName: 'staging',
      });

      expect(result).toEqual(routes);
      expect(mockListEnvironmentRoutes).toHaveBeenCalledWith(
        expect.anything(), // db
        PROJECT_ID,
        'staging',
      );
    });
  });

  // ---------- Input validation (preserved from original tests) ----------
  describe('input validation', () => {
    const uuidSchema = z.string().uuid();
    const nameSchema = z.string().min(1).max(50).regex(/^[a-z0-9-]+$/);

    it('rejects non-uuid projectId', () => {
      expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
    });

    it('accepts lowercase alphanumeric with hyphens for name', () => {
      expect(nameSchema.safeParse('dev').success).toBe(true);
      expect(nameSchema.safeParse('staging-1').success).toBe(true);
      expect(nameSchema.safeParse('prod-us-east').success).toBe(true);
    });

    it('rejects uppercase in name', () => {
      expect(nameSchema.safeParse('Dev').success).toBe(false);
    });

    it('rejects empty name', () => {
      expect(nameSchema.safeParse('').success).toBe(false);
    });

    it('rejects names over 50 characters', () => {
      expect(nameSchema.safeParse('a'.repeat(51)).success).toBe(false);
    });
  });
});
