import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuditLog } from './AuditLog';

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
    approvals: {
      history: {
        queryOptions: vi.fn((opts: { runId: string }) => ({
          queryKey: ['approvals', 'history', opts.runId],
          queryFn: async () => [],
        })),
      },
    },
  },
}));

const sampleEntries = [
  {
    id: 'e1',
    action: 'approved',
    userEmail: 'alice@example.com',
    createdAt: '2026-03-10T10:00:00Z',
    reason: null,
    diffReportId: 'diff-1',
  },
  {
    id: 'e2',
    action: 'rejected',
    userEmail: 'bob@example.com',
    createdAt: '2026-03-10T11:00:00Z',
    reason: 'Layout broken',
    diffReportId: 'diff-2',
  },
  {
    id: 'e3',
    action: 'approved',
    userEmail: 'carol@example.com',
    createdAt: '2026-03-10T12:00:00Z',
    reason: null,
    diffReportId: 'diff-3',
  },
];

describe('AuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders audit log title', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<AuditLog runId="run-1" />);
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('renders entries when data loaded', () => {
    mockUseQuery.mockReturnValue({ data: sampleEntries, isLoading: false });
    render(<AuditLog runId="run-1" />);
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('carol@example.com')).toBeInTheDocument();
  });

  it('filters by action type', () => {
    mockUseQuery.mockReturnValue({ data: sampleEntries, isLoading: false });
    render(<AuditLog runId="run-1" />);

    const select = screen.getByDisplayValue('All actions');
    fireEvent.change(select, { target: { value: 'rejected' } });

    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('carol@example.com')).not.toBeInTheDocument();
  });

  it('filters by user text input', () => {
    mockUseQuery.mockReturnValue({ data: sampleEntries, isLoading: false });
    render(<AuditLog runId="run-1" />);

    const input = screen.getByPlaceholderText('Filter by user...');
    fireEvent.change(input, { target: { value: 'bob' } });

    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<AuditLog runId="run-1" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows empty state when no entries', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<AuditLog runId="run-1" />);
    expect(screen.getByText('No audit entries')).toBeInTheDocument();
  });
});
