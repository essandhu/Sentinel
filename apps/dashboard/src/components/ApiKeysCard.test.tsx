import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.hoisted for mock refs
const { mockCreateMutate, mockRevokeMutate, mockQueryClient } = vi.hoisted(() => ({
  mockCreateMutate: vi.fn(),
  mockRevokeMutate: vi.fn(),
  mockQueryClient: { invalidateQueries: vi.fn() },
}));

// Mock tRPC
vi.mock('../trpc', () => ({
  trpc: {
    apiKeys: {
      list: {
        queryOptions: vi.fn(() => ({
          queryKey: ['apiKeys', 'list'],
          queryFn: async () => [],
        })),
      },
    },
  },
  trpcClient: {
    apiKeys: {
      create: { mutate: mockCreateMutate },
      revoke: { mutate: mockRevokeMutate },
    },
  },
  queryClient: mockQueryClient,
}));

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  };
});

import { useQuery, useMutation } from '@tanstack/react-query';
const mockUseQuery = vi.mocked(useQuery);
const mockUseMutation = vi.mocked(useMutation);

import { ApiKeysCard } from './ApiKeysCard';

const sampleKeys = [
  {
    id: 'key-1',
    name: 'Production',
    keyPrefix: 'sk_live_abc12...',
    createdAt: new Date('2026-01-15T10:00:00Z'),
    revokedAt: null,
    lastUsedAt: new Date('2026-03-01T08:00:00Z'),
  },
  {
    id: 'key-2',
    name: 'Staging',
    keyPrefix: 'sk_live_xyz89...',
    createdAt: new Date('2026-02-20T14:00:00Z'),
    revokedAt: new Date('2026-03-01T12:00:00Z'),
    lastUsedAt: null,
  },
];

const baseMutationReturn = {
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
  status: 'idle' as const,
  submittedAt: 0,
};

describe('ApiKeysCard', () => {
  const mockOnMessage = vi.fn();
  let capturedCreateConfig: { onSuccess?: Function; onError?: Function; mutationFn?: Function };
  let capturedRevokeConfig: { onSuccess?: Function; onError?: Function; mutationFn?: Function };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedCreateConfig = {};
    capturedRevokeConfig = {};

    mockUseQuery.mockReturnValue({
      data: sampleKeys,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    // Track which mutation is being configured (create vs revoke)
    let mutationCallCount = 0;
    mockUseMutation.mockImplementation((options: unknown) => {
      mutationCallCount++;
      if (mutationCallCount % 2 === 1) {
        capturedCreateConfig = options as typeof capturedCreateConfig;
      } else {
        capturedRevokeConfig = options as typeof capturedRevokeConfig;
      }
      return baseMutationReturn as unknown as ReturnType<typeof useMutation>;
    });
  });

  it('renders create button and name input', () => {
    render(<ApiKeysCard onMessage={mockOnMessage} />);

    expect(screen.getByPlaceholderText(/key name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('renders key list with prefixes and dates', () => {
    render(<ApiKeysCard onMessage={mockOnMessage} />);

    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('sk_live_abc12...')).toBeInTheDocument();
    expect(screen.getByText('Staging')).toBeInTheDocument();
    expect(screen.getByText('sk_live_xyz89...')).toBeInTheDocument();
  });

  it('shows revoke button for active keys, not for revoked keys', () => {
    render(<ApiKeysCard onMessage={mockOnMessage} />);

    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
    // Only 1 revoke button (for the active key "Production"), not for revoked "Staging"
    expect(revokeButtons).toHaveLength(1);
  });

  it('shows "Revoked" status for revoked keys', () => {
    render(<ApiKeysCard onMessage={mockOnMessage} />);

    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows empty state when no keys exist', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    render(<ApiKeysCard onMessage={mockOnMessage} />);

    expect(screen.getByText(/no api keys/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useQuery>);

    render(<ApiKeysCard onMessage={mockOnMessage} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows show-once modal with rawKey after creation', async () => {
    render(<ApiKeysCard onMessage={mockOnMessage} />);

    // Simulate successful creation callback
    act(() => {
      capturedCreateConfig.onSuccess?.({
        rawKey: 'sk_live_fullrawkeyvalue123',
        keyPrefix: 'sk_live_fullraw...',
        name: 'New Key',
        id: 'key-3',
        createdAt: new Date(),
      });
    });

    expect(screen.getByText('sk_live_fullrawkeyvalue123')).toBeInTheDocument();
    expect(screen.getByText(/will only be shown once/i)).toBeInTheDocument();
  });

  it('modal has copy button', async () => {
    render(<ApiKeysCard onMessage={mockOnMessage} />);

    act(() => {
      capturedCreateConfig.onSuccess?.({
        rawKey: 'sk_live_testkey',
        keyPrefix: 'sk_live_testke...',
        name: 'Test',
        id: 'key-4',
        createdAt: new Date(),
      });
    });

    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('closing the modal clears the rawKey from state', async () => {
    const user = userEvent.setup();
    render(<ApiKeysCard onMessage={mockOnMessage} />);

    act(() => {
      capturedCreateConfig.onSuccess?.({
        rawKey: 'sk_live_clearme',
        keyPrefix: 'sk_live_clearm...',
        name: 'Clear',
        id: 'key-5',
        createdAt: new Date(),
      });
    });

    expect(screen.getByText('sk_live_clearme')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(screen.queryByText('sk_live_clearme')).not.toBeInTheDocument();
  });

  it('calls onMessage with error on creation failure', () => {
    render(<ApiKeysCard onMessage={mockOnMessage} />);

    act(() => {
      capturedCreateConfig.onError?.(new Error('Key creation failed'));
    });

    expect(mockOnMessage).toHaveBeenCalledWith({
      type: 'error',
      text: 'Key creation failed',
    });
  });
});
