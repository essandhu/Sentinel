import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApprovalChainProgress } from './ApprovalChainProgress';

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
}));

describe('ApprovalChainProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null when chain is empty (no chain defined)', () => {
    mockUseQuery.mockReturnValue({
      data: { chain: [], completed: [], currentStep: null, isComplete: true },
      isLoading: false,
      isError: false,
    });

    const { container } = render(
      <ApprovalChainProgress diffId="diff-1" projectId="proj-1" />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders null when query is loading', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { container } = render(
      <ApprovalChainProgress diffId="diff-1" projectId="proj-1" />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders correct number of step items', () => {
    mockUseQuery.mockReturnValue({
      data: {
        chain: [
          { id: 's1', stepOrder: 1, label: 'Design Review', requiredRole: 'org:admin', requiredUserId: null },
          { id: 's2', stepOrder: 2, label: 'QA Sign-off', requiredRole: null, requiredUserId: null },
          { id: 's3', stepOrder: 3, label: 'Final Approval', requiredRole: null, requiredUserId: 'user-xyz' },
        ],
        completed: [],
        currentStep: { id: 's1', stepOrder: 1, label: 'Design Review', requiredRole: 'org:admin', requiredUserId: null },
        isComplete: false,
      },
      isLoading: false,
      isError: false,
    });

    render(<ApprovalChainProgress diffId="diff-1" projectId="proj-1" />);
    const steps = screen.getAllByTestId(/^chain-step-/);
    expect(steps).toHaveLength(3);
  });

  it('completed step shows approver info and timestamp', () => {
    mockUseQuery.mockReturnValue({
      data: {
        chain: [
          { id: 's1', stepOrder: 1, label: 'Design Review', requiredRole: null, requiredUserId: null },
          { id: 's2', stepOrder: 2, label: 'QA Sign-off', requiredRole: null, requiredUserId: null },
        ],
        completed: [
          { stepOrder: 1, userId: 'u1', userEmail: 'alice@example.com', completedAt: '2026-03-10T10:00:00Z' },
        ],
        currentStep: { id: 's2', stepOrder: 2, label: 'QA Sign-off', requiredRole: null, requiredUserId: null },
        isComplete: false,
      },
      isLoading: false,
      isError: false,
    });

    render(<ApprovalChainProgress diffId="diff-1" projectId="proj-1" />);
    expect(screen.getByText(/alice@example\.com/)).toBeInTheDocument();
    expect(screen.getByTestId('chain-step-1')).toHaveAttribute('data-status', 'completed');
  });

  it('current step is highlighted with awaiting label', () => {
    mockUseQuery.mockReturnValue({
      data: {
        chain: [
          { id: 's1', stepOrder: 1, label: 'Design Review', requiredRole: 'org:admin', requiredUserId: null },
          { id: 's2', stepOrder: 2, label: 'QA Sign-off', requiredRole: null, requiredUserId: null },
        ],
        completed: [
          { stepOrder: 1, userId: 'u1', userEmail: 'alice@example.com', completedAt: '2026-03-10T10:00:00Z' },
        ],
        currentStep: { id: 's2', stepOrder: 2, label: 'QA Sign-off', requiredRole: null, requiredUserId: null },
        isComplete: false,
      },
      isLoading: false,
      isError: false,
    });

    render(<ApprovalChainProgress diffId="diff-1" projectId="proj-1" />);
    expect(screen.getByTestId('chain-step-2')).toHaveAttribute('data-status', 'current');
    expect(screen.getByText(/awaiting approval/i)).toBeInTheDocument();
  });

  it('pending steps are grayed/locked', () => {
    mockUseQuery.mockReturnValue({
      data: {
        chain: [
          { id: 's1', stepOrder: 1, label: 'Design Review', requiredRole: null, requiredUserId: null },
          { id: 's2', stepOrder: 2, label: 'QA Sign-off', requiredRole: null, requiredUserId: null },
          { id: 's3', stepOrder: 3, label: 'Final Approval', requiredRole: null, requiredUserId: null },
        ],
        completed: [],
        currentStep: { id: 's1', stepOrder: 1, label: 'Design Review', requiredRole: null, requiredUserId: null },
        isComplete: false,
      },
      isLoading: false,
      isError: false,
    });

    render(<ApprovalChainProgress diffId="diff-1" projectId="proj-1" />);
    expect(screen.getByTestId('chain-step-2')).toHaveAttribute('data-status', 'pending');
    expect(screen.getByTestId('chain-step-3')).toHaveAttribute('data-status', 'pending');
  });

  it('shows completion message when all steps done', () => {
    mockUseQuery.mockReturnValue({
      data: {
        chain: [
          { id: 's1', stepOrder: 1, label: 'Design Review', requiredRole: null, requiredUserId: null },
        ],
        completed: [
          { stepOrder: 1, userId: 'u1', userEmail: 'alice@example.com', completedAt: '2026-03-10T10:00:00Z' },
        ],
        currentStep: null,
        isComplete: true,
      },
      isLoading: false,
      isError: false,
    });

    render(<ApprovalChainProgress diffId="diff-1" projectId="proj-1" />);
    expect(screen.getByText(/all approval steps complete/i)).toBeInTheDocument();
  });

  it('displays step label and required role for each step', () => {
    mockUseQuery.mockReturnValue({
      data: {
        chain: [
          { id: 's1', stepOrder: 1, label: 'Design Review', requiredRole: 'org:admin', requiredUserId: null },
          { id: 's2', stepOrder: 2, label: 'QA Sign-off', requiredRole: null, requiredUserId: 'user-abc' },
        ],
        completed: [],
        currentStep: { id: 's1', stepOrder: 1, label: 'Design Review', requiredRole: 'org:admin', requiredUserId: null },
        isComplete: false,
      },
      isLoading: false,
      isError: false,
    });

    render(<ApprovalChainProgress diffId="diff-1" projectId="proj-1" />);
    expect(screen.getByText('Design Review')).toBeInTheDocument();
    expect(screen.getByText('QA Sign-off')).toBeInTheDocument();
    expect(screen.getByText(/org:admin/)).toBeInTheDocument();
  });
});
