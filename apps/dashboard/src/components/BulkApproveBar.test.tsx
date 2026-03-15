import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockBulkApproveMutate = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('../trpc', () => ({
  trpcClient: {
    approvals: {
      bulkApprove: {
        mutate: (...args: unknown[]) => mockBulkApproveMutate(...args),
      },
    },
  },
  queryClient: {
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  },
}));

import { BulkApproveBar } from './BulkApproveBar';

describe('BulkApproveBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBulkApproveMutate.mockResolvedValue({ approvedCount: 5 });
    mockInvalidateQueries.mockResolvedValue(undefined);
  });

  it('renders nothing when failedCount is 0', () => {
    const { container } = render(<BulkApproveBar runId="run-1" failedCount={0} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders bar with count when failedCount > 0', () => {
    render(<BulkApproveBar runId="run-1" failedCount={5} />);
    expect(screen.getByText('5 failed diffs')).toBeInTheDocument();
    expect(screen.getByText('Approve All')).toBeInTheDocument();
  });

  it('renders singular text for 1 failed diff', () => {
    render(<BulkApproveBar runId="run-1" failedCount={1} />);
    expect(screen.getByText('1 failed diff')).toBeInTheDocument();
  });

  it('calls bulkApprove mutation when Approve All clicked', async () => {
    render(<BulkApproveBar runId="run-1" failedCount={3} />);
    fireEvent.click(screen.getByText('Approve All'));
    expect(mockBulkApproveMutate).toHaveBeenCalledWith({ runId: 'run-1' });
  });

  it('shows success message after approval', async () => {
    render(<BulkApproveBar runId="run-1" failedCount={3} />);
    fireEvent.click(screen.getByText('Approve All'));

    await waitFor(() => {
      expect(screen.getByText('Approved 5 diffs')).toBeInTheDocument();
    });
  });

  it('includes reason when provided', async () => {
    render(<BulkApproveBar runId="run-1" failedCount={3} />);

    fireEvent.change(screen.getByPlaceholderText('Reason (optional)'), {
      target: { value: 'Design approved' },
    });
    fireEvent.click(screen.getByText('Approve All'));

    expect(mockBulkApproveMutate).toHaveBeenCalledWith({
      runId: 'run-1',
      reason: 'Design approved',
    });
  });
});
