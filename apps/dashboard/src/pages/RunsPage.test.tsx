import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RunsPage } from './RunsPage';

// Mock the trpc module so we can control useTRPC and trpc.runs.list.queryOptions
vi.mock('../trpc', () => ({
  useTRPC: vi.fn(),
  trpc: {
    runs: {
      list: {
        queryOptions: vi.fn(() => ({ queryKey: ['runs', 'list'], queryFn: async () => [] })),
      },
    },
    projects: {
      list: {
        queryOptions: vi.fn(() => ({ queryKey: ['projects', 'list'], queryFn: async () => [] })),
      },
    },
  },
  queryClient: { defaultOptions: {} },
  TRPCProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock @tanstack/react-query's useQuery
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '../trpc';

const mockUseQuery = vi.mocked(useQuery);
const mockUseTRPC = vi.mocked(useTRPC);

function renderPage() {
  return render(
    <MemoryRouter>
      <RunsPage />
    </MemoryRouter>
  );
}

const sampleRuns = [
  {
    id: 'run-uuid-1',
    projectId: 'proj-uuid-1',
    branchName: 'main',
    commitSha: 'abc1234567890',
    status: 'completed',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    completedAt: new Date('2024-01-15T10:05:00Z'),
    totalDiffs: 3,
  },
  {
    id: 'run-uuid-2',
    projectId: 'proj-uuid-1',
    branchName: 'feature/new-ui',
    commitSha: 'def9876543210',
    status: 'failed',
    createdAt: new Date('2024-01-14T09:00:00Z'),
    completedAt: null,
    totalDiffs: 1,
  },
];

describe('RunsPage', () => {
  beforeEach(() => {
    mockUseTRPC.mockReturnValue({} as ReturnType<typeof useTRPC>);
  });

  function mockQueries(runsData: unknown, opts: { isLoading?: boolean; projectsData?: unknown[] } = {}) {
    const { isLoading = false, projectsData = [] } = opts;
    mockUseQuery.mockImplementation((options: any) => {
      if (options?.queryKey?.[0] === 'projects') {
        return { data: projectsData, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
      }
      return { data: runsData, isLoading, isError: false } as ReturnType<typeof useQuery>;
    });
  }

  it('renders "Capture Runs" heading', () => {
    mockQueries([]);
    renderPage();
    expect(screen.getByRole('heading', { name: /capture runs/i })).toBeInTheDocument();
  });

  it('shows loading state while query is pending', () => {
    mockQueries(undefined, { isLoading: true });
    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders run list with branch name', () => {
    mockQueries(sampleRuns);
    renderPage();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('feature/new-ui')).toBeInTheDocument();
  });

  it('renders truncated commit SHA (first 7 chars)', () => {
    mockQueries(sampleRuns);
    renderPage();
    expect(screen.getByText('abc1234')).toBeInTheDocument();
    expect(screen.getByText('def9876')).toBeInTheDocument();
  });

  it('renders status badge for each run', () => {
    mockQueries(sampleRuns);
    renderPage();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('renders diff count for each run', () => {
    mockQueries(sampleRuns);
    renderPage();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders links to /runs/:runId for each run', () => {
    mockQueries(sampleRuns);
    renderPage();
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/runs/run-uuid-1');
    expect(hrefs).toContain('/runs/run-uuid-2');
  });

  it('shows empty state when list is empty', () => {
    mockQueries([]);
    renderPage();
    expect(screen.getByText(/no capture runs found/i)).toBeInTheDocument();
  });

  it('shows "no branch" when branchName is null', () => {
    mockQueries([{ ...sampleRuns[0], branchName: null }]);
    renderPage();
    expect(screen.getByText('no branch')).toBeInTheDocument();
  });

  it('shows "-" when commitSha is null', () => {
    mockQueries([{ ...sampleRuns[0], commitSha: null, suiteName: 'smoke' }]);
    renderPage();
    // The commit column renders "-" for null commitSha
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
