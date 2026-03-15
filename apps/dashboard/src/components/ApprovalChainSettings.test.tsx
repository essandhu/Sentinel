import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalChainSettings } from './ApprovalChainSettings';

const mockUseQuery = vi.fn();
const mockUpsertChain = vi.fn().mockResolvedValue({ count: 1 });
const mockInvalidateQueries = vi.fn();

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
      getChain: {
        queryOptions: vi.fn((opts: { projectId: string }) => ({
          queryKey: ['approvalChains', 'getChain', opts.projectId],
          queryFn: async () => [],
        })),
      },
    },
  },
  trpcClient: {
    approvalChains: {
      upsertChain: { mutate: (...args: unknown[]) => mockUpsertChain(...args) },
    },
  },
  queryClient: {
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  },
}));

describe('ApprovalChainSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "No approval chain" when chain is empty', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<ApprovalChainSettings projectId="proj-1" />);
    expect(screen.getByText(/no approval chain configured/i)).toBeInTheDocument();
    expect(screen.getByText('Add Chain')).toBeInTheDocument();
  });

  it('renders existing steps in form', () => {
    mockUseQuery.mockReturnValue({
      data: [
        { label: 'Design Review', requiredRole: 'org:admin', requiredUserId: null },
        { label: 'QA Sign-off', requiredRole: null, requiredUserId: null },
      ],
      isLoading: false,
      isError: false,
    });

    render(<ApprovalChainSettings projectId="proj-1" />);
    expect(screen.getByTestId('chain-settings-step-1')).toBeInTheDocument();
    expect(screen.getByTestId('chain-settings-step-2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Design Review')).toBeInTheDocument();
    expect(screen.getByDisplayValue('QA Sign-off')).toBeInTheDocument();
  });

  it('add step button adds a row', () => {
    mockUseQuery.mockReturnValue({
      data: [
        { label: 'Step 1', requiredRole: null, requiredUserId: null },
      ],
      isLoading: false,
      isError: false,
    });

    render(<ApprovalChainSettings projectId="proj-1" />);
    expect(screen.queryByTestId('chain-settings-step-2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-step-btn'));
    expect(screen.getByTestId('chain-settings-step-2')).toBeInTheDocument();
  });

  it('save calls upsertChain mutation', async () => {
    mockUseQuery.mockReturnValue({
      data: [
        { label: 'Design Review', requiredRole: 'org:admin', requiredUserId: null },
      ],
      isLoading: false,
      isError: false,
    });

    render(<ApprovalChainSettings projectId="proj-1" />);
    fireEvent.click(screen.getByTestId('save-chain-btn'));

    await waitFor(() => {
      expect(mockUpsertChain).toHaveBeenCalledWith({
        projectId: 'proj-1',
        steps: [
          { stepOrder: 1, label: 'Design Review', requiredRole: 'org:admin', requiredUserId: null },
        ],
      });
    });
  });
});
