import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @clerk/backend before importing routers
const mockCreateOrganization = vi.fn();
const mockCreateOrganizationInvitation = vi.fn();
const mockUpdateOrganizationMembership = vi.fn();
const mockGetOrganizationMembershipList = vi.fn();

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => ({
    organizations: {
      createOrganization: mockCreateOrganization,
      createOrganizationInvitation: mockCreateOrganizationInvitation,
      updateOrganizationMembership: mockUpdateOrganizationMembership,
      getOrganizationMembershipList: mockGetOrganizationMembershipList,
    },
  })),
}));

// Mock @sentinel/db
vi.mock('@sentinel/db', () => {
  const mockDb = { select: vi.fn() };
  return {
    createDb: vi.fn(() => mockDb),
    projects: { id: 'projects.id', name: 'projects.name', workspaceId: 'projects.workspaceId', createdAt: 'projects.createdAt' },
    captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId', createdAt: 'captureRuns.createdAt' },
    snapshots: { id: 'snapshots.id', runId: 'snapshots.runId' },
    diffReports: { id: 'diffReports.id', snapshotId: 'diffReports.snapshotId' },
  };
});

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  count: vi.fn((col) => ({ _type: 'count', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ _type: 'sql', strings, vals })),
}));

describe('workspaces router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('workspaces.create', () => {
    it('creates a workspace by calling Clerk createOrganization and returns organizationId and name', async () => {
      mockCreateOrganization.mockResolvedValue({
        id: 'org_new123',
        name: 'My Team',
      });

      const { appRouter } = await import('../../src/routers/index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user_1', orgId: 'org_existing', orgRole: 'org:admin' },
      } as any);

      const result = await caller.workspaces.create({ name: 'My Team' });

      expect(result).toEqual({ organizationId: 'org_new123', name: 'My Team' });
      expect(mockCreateOrganization).toHaveBeenCalledWith({
        name: 'My Team',
        createdBy: 'user_1',
      });
    });
  });

  describe('workspaces.invite', () => {
    it('invites a member via Clerk createOrganizationInvitation and returns invitationId', async () => {
      mockCreateOrganizationInvitation.mockResolvedValue({
        id: 'inv_abc123',
      });

      const { appRouter } = await import('../../src/routers/index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user_1', orgId: 'org_abc', orgRole: 'org:admin' },
      } as any);

      const result = await caller.workspaces.invite({
        emailAddress: 'member@example.com',
        role: 'org:reviewer',
      });

      expect(result).toEqual({ invitationId: 'inv_abc123' });
      expect(mockCreateOrganizationInvitation).toHaveBeenCalledWith({
        organizationId: 'org_abc',
        inviterUserId: 'user_1',
        emailAddress: 'member@example.com',
        role: 'org:reviewer',
      });
    });

    it('rejects non-admin caller with FORBIDDEN', async () => {
      const { appRouter } = await import('../../src/routers/index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user_2', orgId: 'org_abc', orgRole: 'org:viewer' },
      } as any);

      await expect(
        caller.workspaces.invite({
          emailAddress: 'member@example.com',
          role: 'org:viewer',
        }),
      ).rejects.toThrow('Admin role required');
    });
  });

  describe('workspaces.changeRole', () => {
    it('changes a member role via Clerk updateOrganizationMembership and returns userId and role', async () => {
      mockUpdateOrganizationMembership.mockResolvedValue({
        publicUserData: { userId: 'user_target' },
        role: 'org:reviewer',
      });

      const { appRouter } = await import('../../src/routers/index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user_1', orgId: 'org_abc', orgRole: 'org:admin' },
      } as any);

      const result = await caller.workspaces.changeRole({
        userId: 'user_target',
        role: 'org:reviewer',
      });

      expect(result).toEqual({ userId: 'user_target', role: 'org:reviewer' });
      expect(mockUpdateOrganizationMembership).toHaveBeenCalledWith({
        organizationId: 'org_abc',
        userId: 'user_target',
        role: 'org:reviewer',
      });
    });

    it('rejects non-admin caller with FORBIDDEN', async () => {
      const { appRouter } = await import('../../src/routers/index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user_2', orgId: 'org_abc', orgRole: 'org:reviewer' },
      } as any);

      await expect(
        caller.workspaces.changeRole({
          userId: 'user_target',
          role: 'org:admin',
        }),
      ).rejects.toThrow('Admin role required');
    });
  });

  describe('workspaces.members', () => {
    it('returns list of workspace members from Clerk', async () => {
      mockGetOrganizationMembershipList.mockResolvedValue({
        data: [
          {
            publicUserData: { userId: 'user_1', identifier: 'admin@example.com' },
            role: 'org:admin',
          },
          {
            publicUserData: { userId: 'user_2', identifier: 'viewer@example.com' },
            role: 'org:viewer',
          },
        ],
      });

      const { appRouter } = await import('../../src/routers/index.js');
      const caller = appRouter.createCaller({
        auth: { userId: 'user_1', orgId: 'org_abc', orgRole: 'org:admin' },
      } as any);

      const result = await caller.workspaces.members();

      expect(result).toEqual([
        { userId: 'user_1', role: 'org:admin', identifier: 'admin@example.com' },
        { userId: 'user_2', role: 'org:viewer', identifier: 'viewer@example.com' },
      ]);
      expect(mockGetOrganizationMembershipList).toHaveBeenCalledWith({
        organizationId: 'org_abc',
      });
    });
  });
});
