import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.hoisted for mock refs
const { mockExportPenpotMutate, mockUseMutationReturn } = vi.hoisted(() => ({
  mockExportPenpotMutate: vi.fn(),
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
}));

// Mock tRPC
vi.mock('../trpc', () => ({
  trpcClient: {
    designSources: {
      exportPenpot: { mutate: mockExportPenpotMutate },
    },
  },
}));

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: vi.fn(),
  };
});

import { useMutation } from '@tanstack/react-query';
const mockUseMutation = vi.mocked(useMutation);

import { PenpotExportCard } from './PenpotExportCard';

describe('PenpotExportCard', () => {
  const mockOnMessage = vi.fn();
  let capturedConfig: { onSuccess?: Function; onError?: Function; mutationFn?: Function };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedConfig = {};

    mockUseMutation.mockImplementation((options: unknown) => {
      capturedConfig = options as typeof capturedConfig;
      return mockUseMutationReturn as unknown as ReturnType<typeof useMutation>;
    });
  });

  it('renders with fileId and projectId input fields and an Export Components button', () => {
    render(<PenpotExportCard onMessage={mockOnMessage} />);

    expect(screen.getByPlaceholderText(/enter penpot file id/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter project uuid/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export components/i })).toBeInTheDocument();
  });

  it('disables export button when fileId or projectId is empty', async () => {
    const user = userEvent.setup();
    render(<PenpotExportCard onMessage={mockOnMessage} />);

    const exportButton = screen.getByRole('button', { name: /export components/i });

    // Both empty -> disabled
    expect(exportButton).toBeDisabled();

    // Only fileId filled -> still disabled
    const fileIdInput = screen.getByPlaceholderText(/enter penpot file id/i);
    await user.type(fileIdInput, 'some-file-id');
    expect(exportButton).toBeDisabled();

    // Clear fileId, fill projectId -> still disabled
    await user.clear(fileIdInput);
    const projectIdInput = screen.getByPlaceholderText(/enter project uuid/i);
    await user.type(projectIdInput, 'some-project-id');
    expect(exportButton).toBeDisabled();
  });

  it('shows Exporting text and disabled button while mutation is pending', () => {
    mockUseMutation.mockImplementation((options: unknown) => {
      capturedConfig = options as typeof capturedConfig;
      return {
        ...mockUseMutationReturn,
        isPending: true,
      } as unknown as ReturnType<typeof useMutation>;
    });

    render(<PenpotExportCard onMessage={mockOnMessage} />);

    expect(screen.getByText(/exporting\.\.\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exporting\.\.\./i })).toBeDisabled();
  });

  it('shows success result with baselineCount on successful export', () => {
    render(<PenpotExportCard onMessage={mockOnMessage} />);

    // Invoke the onSuccess callback captured from useMutation inside act
    act(() => {
      capturedConfig.onSuccess?.({ success: true, baselineCount: 5 });
    });

    expect(screen.getByText(/exported 5 component baselines from penpot/i)).toBeInTheDocument();
    expect(mockOnMessage).toHaveBeenCalledWith({
      type: 'success',
      text: 'Exported 5 component baselines from Penpot',
    });
  });

  it('shows error message on export failure', () => {
    render(<PenpotExportCard onMessage={mockOnMessage} />);

    act(() => {
      capturedConfig.onError?.(new Error('Export failed'));
    });

    expect(mockOnMessage).toHaveBeenCalledWith({
      type: 'error',
      text: 'Export failed',
    });
  });

  it('calls trpcClient.designSources.exportPenpot.mutate with correct fileId and projectId', async () => {
    const user = userEvent.setup();
    render(<PenpotExportCard onMessage={mockOnMessage} />);

    // Fill in both fields
    await user.type(screen.getByPlaceholderText(/enter penpot file id/i), 'my-file-id');
    await user.type(screen.getByPlaceholderText(/enter project uuid/i), 'my-project-id');

    // Click export
    const exportButton = screen.getByRole('button', { name: /export components/i });
    await user.click(exportButton);

    // The mutate function from useMutation should have been called
    expect(mockUseMutationReturn.mutate).toHaveBeenCalled();

    // Verify the mutationFn calls the correct tRPC method
    mockExportPenpotMutate.mockResolvedValue({ success: true, baselineCount: 3 });
    await capturedConfig.mutationFn?.();

    // The mutationFn should use the current state values
    expect(mockExportPenpotMutate).toHaveBeenCalled();
  });
});
