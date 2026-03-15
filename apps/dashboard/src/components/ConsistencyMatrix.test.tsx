import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsistencyMatrix } from './ConsistencyMatrix';

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
    components: {
      consistency: {
        queryOptions: vi.fn((opts: { projectId: string }) => ({
          queryKey: ['components', 'consistency', opts.projectId],
          queryFn: async () => [],
        })),
      },
    },
  },
}));

describe('ConsistencyMatrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<ConsistencyMatrix projectId="proj-1" />);
    expect(screen.getByText('Loading consistency data...')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<ConsistencyMatrix projectId="proj-1" />);
    expect(screen.getByText('Run a capture to see consistency results.')).toBeInTheDocument();
  });

  it('renders table with components and URLs', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          componentId: 'c1',
          componentName: 'Button',
          pages: [
            { url: 'https://example.com/home', snapshotId: 's1', status: 'consistent' },
            { url: 'https://example.com/about', snapshotId: 's2', status: 'inconsistent' },
          ],
        },
        {
          componentId: 'c2',
          componentName: 'Header',
          pages: [
            { url: 'https://example.com/home', snapshotId: 's3', status: 'consistent' },
            { url: 'https://example.com/about', snapshotId: null, status: 'missing' },
          ],
        },
      ],
      isLoading: false,
    });

    render(<ConsistencyMatrix projectId="proj-1" />);
    expect(screen.getByText('Button')).toBeInTheDocument();
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Component')).toBeInTheDocument();
  });

  it('shows correct status icons (consistent, inconsistent, missing)', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          componentId: 'c1',
          componentName: 'Card',
          pages: [
            { url: 'https://example.com/home', snapshotId: 's1', status: 'consistent' },
            { url: 'https://example.com/about', snapshotId: null, status: 'inconsistent' },
            { url: 'https://example.com/contact', snapshotId: null, status: 'missing' },
          ],
        },
      ],
      isLoading: false,
    });

    render(<ConsistencyMatrix projectId="proj-1" />);

    const consistent = screen.getByTitle('Consistent');
    expect(consistent).toBeInTheDocument();

    const inconsistent = screen.getByTitle('Inconsistent');
    expect(inconsistent).toBeInTheDocument();

    const missing = screen.getByTitle('Missing');
    expect(missing).toBeInTheDocument();

    // Should show inconsistency count
    expect(screen.getByText(/2 inconsistencies detected/)).toBeInTheDocument();
  });
});
