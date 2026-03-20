import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock useSlideOver
vi.mock('../hooks/useSlideOver', () => ({
  useSlideOver: vi.fn(() => ({
    isOpen: false,
    content: null,
    title: '',
    open: vi.fn(),
    close: vi.fn(),
  })),
}));

// Mock trpc
vi.mock('../trpc', () => ({
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
}));

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

import { useQuery } from '@tanstack/react-query';
import { CommandCenterPage } from './CommandCenterPage';

const mockUseQuery = vi.mocked(useQuery);

const sampleRuns = [
  {
    id: 'run-1',
    projectId: 'proj-1',
    branchName: 'main',
    commitSha: 'abc1234',
    status: 'completed',
    createdAt: '2026-03-18T10:00:00Z',
    completedAt: '2026-03-18T10:05:00Z',
    totalDiffs: 2,
    suiteName: null,
  },
  {
    id: 'run-2',
    projectId: 'proj-1',
    branchName: 'feat/login',
    commitSha: 'def5678',
    status: 'failed',
    createdAt: '2026-03-17T09:00:00Z',
    completedAt: null,
    totalDiffs: 5,
    suiteName: null,
  },
  {
    id: 'run-3',
    projectId: 'proj-2',
    branchName: 'develop',
    commitSha: 'ghi9012',
    status: 'pending',
    createdAt: '2026-03-16T08:00:00Z',
    completedAt: null,
    totalDiffs: 0,
    suiteName: null,
  },
];

function mockQueries(
  runsData: unknown,
  opts: { isLoading?: boolean; projectsData?: unknown[] } = {},
) {
  const { isLoading = false, projectsData = [] } = opts;
  mockUseQuery.mockImplementation((options: any) => {
    if (options?.queryKey?.[0] === 'projects') {
      return { data: projectsData, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
    }
    return { data: runsData, isLoading, isError: false } as ReturnType<typeof useQuery>;
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CommandCenterPage />
    </MemoryRouter>,
  );
}

describe('CommandCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Command Center" heading', () => {
    mockQueries(sampleRuns);
    renderPage();
    expect(screen.getByRole('heading', { name: /command center/i })).toBeInTheDocument();
  });

  it('renders StatusStrip section labels', () => {
    mockQueries(sampleRuns);
    renderPage();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders "Needs Attention" section label', () => {
    mockQueries(sampleRuns);
    renderPage();
    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
  });

  it('renders "Recent Activity" section label', () => {
    mockQueries(sampleRuns);
    renderPage();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('renders "Recent Runs" section label', () => {
    mockQueries(sampleRuns);
    renderPage();
    expect(screen.getByText('Recent Runs')).toBeInTheDocument();
  });

  it('shows loading state when isLoading', () => {
    mockQueries(undefined, { isLoading: true });
    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows empty state when no runs', () => {
    mockQueries([]);
    renderPage();
    expect(screen.getByText(/no capture runs/i)).toBeInTheDocument();
  });
});
