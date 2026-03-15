import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.hoisted for mock refs
const { mockUpdateMutate, mockUseMutationReturn, mockQueryClient } = vi.hoisted(() => ({
  mockUpdateMutate: vi.fn(),
  mockUseMutationReturn: {
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
  },
  mockQueryClient: { invalidateQueries: vi.fn() },
}));

// Mock tRPC
vi.mock('../trpc', () => ({
  trpc: {
    notificationPreferences: {
      get: {
        queryOptions: vi.fn(() => ({
          queryKey: ['notificationPreferences', 'get'],
          queryFn: async () => ({
            drift_detected: { slack: true, jira: false },
            approval_requested: { slack: true, jira: true },
            scheduled_capture_failed: { slack: false, jira: true },
            rejection_created: { slack: true, jira: true },
          }),
        })),
      },
    },
  },
  trpcClient: {
    notificationPreferences: {
      update: { mutate: mockUpdateMutate },
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

import { NotificationPreferencesCard } from './NotificationPreferencesCard';

const defaultPrefs = {
  drift_detected: { slack: true, jira: false },
  approval_requested: { slack: true, jira: true },
  scheduled_capture_failed: { slack: false, jira: true },
  rejection_created: { slack: true, jira: true },
};

describe('NotificationPreferencesCard', () => {
  const mockOnMessage = vi.fn();
  let capturedMutationConfig: { onSuccess?: Function; onError?: Function; mutationFn?: Function };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedMutationConfig = {};

    mockUseQuery.mockReturnValue({
      data: defaultPrefs,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    mockUseMutation.mockImplementation((options: unknown) => {
      capturedMutationConfig = options as typeof capturedMutationConfig;
      return mockUseMutationReturn as unknown as ReturnType<typeof useMutation>;
    });
  });

  it('renders 4 event type labels', () => {
    render(<NotificationPreferencesCard onMessage={mockOnMessage} />);

    expect(screen.getByText('Drift Detected')).toBeInTheDocument();
    expect(screen.getByText('Approval Requested')).toBeInTheDocument();
    expect(screen.getByText('Scheduled Capture Failed')).toBeInTheDocument();
    expect(screen.getByText('Rejection Created')).toBeInTheDocument();
  });

  it('renders 8 checkboxes (4 events x 2 channels)', () => {
    render(<NotificationPreferencesCard onMessage={mockOnMessage} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(8);
  });

  it('checkboxes reflect loaded preferences (some checked, some unchecked)', () => {
    render(<NotificationPreferencesCard onMessage={mockOnMessage} />);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // drift_detected: slack=true, jira=false
    // approval_requested: slack=true, jira=true
    // scheduled_capture_failed: slack=false, jira=true
    // rejection_created: slack=true, jira=true
    // Order: [drift-slack, drift-jira, approval-slack, approval-jira, capture-slack, capture-jira, rejection-slack, rejection-jira]
    expect(checkboxes[0].checked).toBe(true);   // drift_detected slack
    expect(checkboxes[1].checked).toBe(false);  // drift_detected jira
    expect(checkboxes[2].checked).toBe(true);   // approval_requested slack
    expect(checkboxes[3].checked).toBe(true);   // approval_requested jira
    expect(checkboxes[4].checked).toBe(false);  // scheduled_capture_failed slack
    expect(checkboxes[5].checked).toBe(true);   // scheduled_capture_failed jira
    expect(checkboxes[6].checked).toBe(true);   // rejection_created slack
    expect(checkboxes[7].checked).toBe(true);   // rejection_created jira
  });

  it('clicking a checkbox toggles its state', async () => {
    const user = userEvent.setup();
    render(<NotificationPreferencesCard onMessage={mockOnMessage} />);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // drift_detected jira is unchecked initially
    expect(checkboxes[1].checked).toBe(false);

    await user.click(checkboxes[1]);
    expect(checkboxes[1].checked).toBe(true);

    // Toggle it back
    await user.click(checkboxes[1]);
    expect(checkboxes[1].checked).toBe(false);
  });

  it('clicking Save calls mutation with updated preferences', async () => {
    const user = userEvent.setup();
    render(<NotificationPreferencesCard onMessage={mockOnMessage} />);

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    expect(mockUseMutationReturn.mutate).toHaveBeenCalled();

    // Verify the mutationFn calls the correct tRPC method
    mockUpdateMutate.mockResolvedValue({ success: true });
    await capturedMutationConfig.mutationFn?.();
    expect(mockUpdateMutate).toHaveBeenCalled();
  });

  it('shows loading text when data is loading', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useQuery>);

    render(<NotificationPreferencesCard onMessage={mockOnMessage} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('calls onMessage with success on save success', () => {
    render(<NotificationPreferencesCard onMessage={mockOnMessage} />);

    act(() => {
      capturedMutationConfig.onSuccess?.();
    });

    expect(mockOnMessage).toHaveBeenCalledWith({
      type: 'success',
      text: 'Notification preferences saved.',
    });
  });

  it('calls onMessage with error on save failure', () => {
    render(<NotificationPreferencesCard onMessage={mockOnMessage} />);

    act(() => {
      capturedMutationConfig.onError?.(new Error('Save failed'));
    });

    expect(mockOnMessage).toHaveBeenCalledWith({
      type: 'error',
      text: 'Save failed',
    });
  });
});
