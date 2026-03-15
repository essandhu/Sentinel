import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovalButtons } from './ApprovalButtons';

const mockApprove = vi.fn().mockResolvedValue({ success: true });
const mockReject = vi.fn().mockResolvedValue({ success: true });
const mockDefer = vi.fn().mockResolvedValue({ success: true });
const mockInvalidateQueries = vi.fn();
const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
  };
});

vi.mock('../trpc', () => ({
  trpc: {
    approvalChains: {
      getProgress: {
        queryOptions: vi.fn((opts: { diffReportId: string }) => ({
          queryKey: ['approvalChains', 'getProgress', opts.diffReportId],
          queryFn: async () => ({ chain: [], completed: [], currentStep: null, isComplete: true }),
        })),
      },
    },
  },
  trpcClient: {
    approvals: {
      approve: { mutate: (...args: unknown[]) => mockApprove(...args) },
      reject: { mutate: (...args: unknown[]) => mockReject(...args) },
      defer: { mutate: (...args: unknown[]) => mockDefer(...args) },
    },
  },
  queryClient: {
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  },
}));

describe('ApprovalButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no chain (legacy behavior)
    mockUseQuery.mockReturnValue({
      data: { chain: [], completed: [], currentStep: null, isComplete: true },
      isLoading: false,
      isError: false,
    });
  });

  it('renders Approve, Reject, and Defer buttons', () => {
    render(<ApprovalButtons diffId="test-id" />);
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.getByText('Defer')).toBeInTheDocument();
  });

  it('calls approve mutate with correct diffReportId on click', async () => {
    render(<ApprovalButtons diffId="test-id" />);
    fireEvent.click(screen.getByText('Approve'));
    expect(mockApprove).toHaveBeenCalledWith({ diffReportId: 'test-id' });
  });

  it('defer shows reason input and submit is disabled until reason provided', () => {
    render(<ApprovalButtons diffId="test-id" />);
    fireEvent.click(screen.getByText('Defer'));
    const input = screen.getByPlaceholderText('Reason for deferral');
    expect(input).toBeInTheDocument();
    const submitBtn = screen.getByText('Submit');
    expect(submitBtn).toBeDisabled();
    fireEvent.change(input, { target: { value: 'Need design review' } });
    expect(submitBtn).not.toBeDisabled();
  });

  it('does not render when canApprove is false', () => {
    const { container } = render(<ApprovalButtons diffId="test-id" canApprove={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows "Approve Step" label when chain exists and is not complete', () => {
    mockUseQuery.mockReturnValue({
      data: {
        chain: [{ stepOrder: 1 }, { stepOrder: 2 }],
        completed: [{ stepOrder: 1 }],
        currentStep: { stepOrder: 2 },
        isComplete: false,
      },
      isLoading: false,
      isError: false,
    });

    render(<ApprovalButtons diffId="test-id" />);
    expect(screen.getByText('Approve Step')).toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
  });

  it('shows "Fully Approved" badge when chain is complete', () => {
    mockUseQuery.mockReturnValue({
      data: {
        chain: [{ stepOrder: 1 }],
        completed: [{ stepOrder: 1 }],
        currentStep: null,
        isComplete: true,
      },
      isLoading: false,
      isError: false,
    });

    render(<ApprovalButtons diffId="test-id" />);
    expect(screen.getByText('Fully Approved')).toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Approve Step')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });
});
