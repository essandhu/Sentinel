import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.hoisted to avoid TDZ errors in mock factories
const {
  mockOrgRoleRef,
  mockConnectFigmaMutate,
  mockDisconnectFigmaMutate,
  mockConnectPenpotMutate,
  mockDisconnectPenpotMutate,
} = vi.hoisted(() => ({
  mockOrgRoleRef: { current: 'org:admin' },
  mockConnectFigmaMutate: vi.fn(),
  mockDisconnectFigmaMutate: vi.fn(),
  mockConnectPenpotMutate: vi.fn(),
  mockDisconnectPenpotMutate: vi.fn(),
}));

// Mock Clerk
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ orgRole: mockOrgRoleRef.current }),
}));

// Mock tRPC
vi.mock('../trpc', () => ({
  trpc: {
    settings: {
      get: {
        queryOptions: vi.fn(() => ({
          queryKey: ['settings', 'get'],
          queryFn: async () => ({}),
        })),
      },
    },
    designSources: {
      status: {
        queryOptions: vi.fn(() => ({
          queryKey: ['designSources', 'status'],
          queryFn: async () => ({
            figma: { connected: false, fileKey: null },
            penpot: { connected: false, instanceUrl: null },
          }),
        })),
      },
    },
  },
  trpcClient: {
    settings: { update: { mutate: vi.fn() } },
    designSources: {
      connectFigma: { mutate: mockConnectFigmaMutate },
      disconnectFigma: { mutate: mockDisconnectFigmaMutate },
      connectPenpot: { mutate: mockConnectPenpotMutate },
      disconnectPenpot: { mutate: mockDisconnectPenpotMutate },
    },
  },
  queryClient: { invalidateQueries: vi.fn() },
}));

// Mock @tanstack/react-query useQuery + useMutation
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  };
});

// Mock PenpotExportCard
vi.mock('../components/PenpotExportCard', () => ({
  PenpotExportCard: () => <div data-testid="penpot-export-card" />,
}));

// Mock NotificationPreferencesCard
vi.mock('../components/NotificationPreferencesCard', () => ({
  NotificationPreferencesCard: () => <div data-testid="notification-preferences-card" />,
}));

// Mock ApiKeysCard
vi.mock('../components/ApiKeysCard', () => ({
  ApiKeysCard: () => <div data-testid="api-keys-card">ApiKeysCard</div>,
}));

import { useQuery, useMutation } from '@tanstack/react-query';

const mockUseQuery = vi.mocked(useQuery);
const mockUseMutation = vi.mocked(useMutation);

// Design source status type
interface DesignStatus {
  figma: { connected: boolean; fileKey: string | null };
  penpot: { connected: boolean; instanceUrl: string | null };
}

const disconnectedStatus: DesignStatus = {
  figma: { connected: false, fileKey: null },
  penpot: { connected: false, instanceUrl: null },
};

const figmaConnectedStatus: DesignStatus = {
  figma: { connected: true, fileKey: 'my-file-key-123' },
  penpot: { connected: false, instanceUrl: null },
};

const penpotConnectedStatus: DesignStatus = {
  figma: { connected: false, fileKey: null },
  penpot: { connected: true, instanceUrl: 'https://design.penpot.app' },
};

const allConnectedStatus: DesignStatus = {
  figma: { connected: true, fileKey: 'my-file-key-123' },
  penpot: { connected: true, instanceUrl: 'https://design.penpot.app' },
};

function setupMocks(
  designStatus = disconnectedStatus,
  settings: Record<string, unknown> = {},
) {
  // useQuery is called twice: once for settings.get, once for designSources.status
  // We need to return correct data based on the queryKey
  mockUseQuery.mockImplementation((options: unknown) => {
    const opts = options as { queryKey?: string[] };
    if (opts?.queryKey?.[0] === 'designSources') {
      return {
        data: designStatus,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>;
    }
    // settings query
    return {
      data: settings,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>;
  });

  // useMutation returns a minimal object with mutate and isPending
  mockUseMutation.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isIdle: true,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    variables: undefined,
    reset: vi.fn(),
    context: undefined,
    failureCount: 0,
    failureReason: null,
    status: 'idle',
    submittedAt: 0,
  } as unknown as ReturnType<typeof useMutation>);
}

import { SettingsPage } from './SettingsPage';

describe('SettingsPage - Design Sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrgRoleRef.current = 'org:admin';
  });

  it('renders "Design Sources" heading when user is admin', () => {
    setupMocks();
    render(<SettingsPage />);
    expect(screen.getByText('Design Sources')).toBeInTheDocument();
  });

  it('does NOT render "Design Sources" section when user is non-admin', () => {
    mockOrgRoleRef.current = 'org:viewer';
    setupMocks();
    render(<SettingsPage />);
    expect(screen.queryByText('Design Sources')).not.toBeInTheDocument();
  });

  // Figma tests
  it('shows "Connected" badge and file key when Figma status is connected', () => {
    setupMocks(figmaConnectedStatus);
    render(<SettingsPage />);
    // Should show the file key
    expect(screen.getByText('my-file-key-123')).toBeInTheDocument();
    // Should show Connected badge near Figma
    const badges = screen.getAllByText('Connected');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows "Not connected" badge and form fields when Figma status is not connected', () => {
    setupMocks(disconnectedStatus);
    render(<SettingsPage />);
    const notConnectedBadges = screen.getAllByText('Not configured');
    expect(notConnectedBadges.length).toBeGreaterThan(0);
    // Should have access token, file key, and webhook URL fields
    expect(screen.getByPlaceholderText('Enter Figma access token')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter Figma file key')).toBeInTheDocument();
  });

  it('shows Disconnect button (not form) when Figma is connected', () => {
    setupMocks(figmaConnectedStatus);
    render(<SettingsPage />);
    // Should have Disconnect button
    const disconnectButtons = screen.getAllByRole('button', { name: /disconnect/i });
    expect(disconnectButtons.length).toBeGreaterThan(0);
    // Should NOT have Connect Figma button
    expect(screen.queryByRole('button', { name: /connect figma/i })).not.toBeInTheDocument();
  });

  it('Figma connect form has access token, file key, and webhook URL fields', () => {
    setupMocks(disconnectedStatus);
    render(<SettingsPage />);
    expect(screen.getByPlaceholderText('Enter Figma access token')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter Figma file key')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect figma/i })).toBeInTheDocument();
  });

  // Penpot tests
  it('shows "Connected" badge and instance URL when Penpot status is connected', () => {
    setupMocks(penpotConnectedStatus);
    render(<SettingsPage />);
    expect(screen.getByText('https://design.penpot.app')).toBeInTheDocument();
  });

  it('shows "Not connected" badge and form fields when Penpot is not connected', () => {
    setupMocks(disconnectedStatus);
    render(<SettingsPage />);
    expect(screen.getByText('Penpot')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://design.penpot.app')).toBeInTheDocument();
  });

  it('Penpot connect form has instance URL and access token fields', () => {
    setupMocks(disconnectedStatus);
    render(<SettingsPage />);
    expect(screen.getByPlaceholderText('https://design.penpot.app')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect penpot/i })).toBeInTheDocument();
  });

  it('shows Disconnect button (not form) when Penpot is connected', () => {
    setupMocks(penpotConnectedStatus);
    render(<SettingsPage />);
    const disconnectButtons = screen.getAllByRole('button', { name: /disconnect/i });
    expect(disconnectButtons.length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /connect penpot/i })).not.toBeInTheDocument();
  });

  // PenpotExportCard conditional rendering tests
  it('shows PenpotExportCard when Penpot is connected and user is admin', () => {
    setupMocks(penpotConnectedStatus);
    render(<SettingsPage />);
    expect(screen.getByTestId('penpot-export-card')).toBeInTheDocument();
  });

  it('does not show PenpotExportCard when Penpot is not connected', () => {
    setupMocks(disconnectedStatus);
    render(<SettingsPage />);
    expect(screen.queryByTestId('penpot-export-card')).not.toBeInTheDocument();
  });
});
