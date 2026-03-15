import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock Clerk
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ orgRole: 'org:admin' }),
}));

// Mock tRPC
vi.mock('../trpc', () => ({
  trpc: {
    healthScores: {
      projectScore: {
        queryOptions: vi.fn((opts: { projectId: string }) => ({
          queryKey: ['healthScores', 'projectScore', opts.projectId],
          queryFn: async () => null,
        })),
      },
      componentScores: {
        queryOptions: vi.fn((opts: { projectId: string }) => ({
          queryKey: ['healthScores', 'componentScores', opts.projectId],
          queryFn: async () => [],
        })),
      },
      trend: {
        queryOptions: vi.fn(
          (opts: { projectId: string; windowDays?: string; componentId?: string }) => ({
            queryKey: ['healthScores', 'trend', opts.projectId, opts.windowDays],
            queryFn: async () => [],
          }),
        ),
      },
    },
    a11y: {
      byProject: {
        queryOptions: vi.fn((opts: { projectId: string }) => ({
          queryKey: ['a11y', 'byProject', opts.projectId],
          queryFn: async () => null,
        })),
      },
    },
    stability: {
      list: {
        queryOptions: vi.fn((opts: any) => ({
          queryKey: ['stability', 'list', opts.projectId],
          queryFn: async () => [],
        })),
      },
      flipHistory: {
        queryOptions: vi.fn((opts: any) => ({
          queryKey: ['stability', 'flipHistory', opts],
          queryFn: async () => [],
        })),
      },
    },
    lighthouse: {
      trend: {
        queryOptions: vi.fn((opts: any) => ({
          queryKey: ['lighthouse', 'trend', opts],
          queryFn: async () => [],
        })),
      },
      budgetsList: {
        queryOptions: vi.fn((opts: any) => ({
          queryKey: ['lighthouse', 'budgetsList', opts],
          queryFn: async () => [],
        })),
      },
      routeUrls: {
        queryOptions: vi.fn((opts: any) => ({
          queryKey: ['lighthouse', 'routeUrls', opts],
          queryFn: async () => [],
        })),
      },
    },
  },
}));

// Mock @tanstack/react-query: useQuery and useQueries
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
    useQueries: vi.fn(),
  };
});

// Mock sub-components to avoid Recharts/SVG jsdom issues
vi.mock('../components/HealthGauge', () => ({
  HealthGauge: ({ score }: { score: number }) => (
    <div data-testid="health-gauge">{score}</div>
  ),
}));

vi.mock('../components/HealthTrendChart', () => ({
  HealthTrendChart: () => <div data-testid="health-trend-chart" />,
}));

vi.mock('../components/ComponentScoreList', () => ({
  ComponentScoreList: () => <div data-testid="component-score-list" />,
}));

vi.mock('../components/NeedsAttention', () => ({
  NeedsAttention: () => <div data-testid="needs-attention" />,
}));

vi.mock('../components/PerformanceScoreChart', () => ({
  PerformanceScoreChart: () => <div data-testid="performance-score-chart" />,
}));

vi.mock('../components/StabilityScoreList', () => ({
  StabilityScoreList: ({ scores }: { scores: any[] }) => (
    <div data-testid="stability-score-list">
      {scores.length === 0 && <span>No unstable routes detected</span>}
      {scores.map((s: any, i: number) => (
        <div key={i} data-testid="stability-row">
          {s.url} {s.viewport} {s.stabilityScore} {s.flipCount}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../components/FlipHistoryChart', () => ({
  FlipHistoryChart: ({ routeLabel }: { routeLabel: string }) => (
    <div data-testid="flip-history-chart">{routeLabel}</div>
  ),
}));

import { useQuery, useQueries } from '@tanstack/react-query';
import { HealthPage } from './HealthPage';

const mockUseQuery = vi.mocked(useQuery);
const mockUseQueries = vi.mocked(useQueries);

function renderPage(projectId = 'proj-uuid-1') {
  return render(
    <MemoryRouter initialEntries={[`/projects/${projectId}/health`]}>
      <Routes>
        <Route path="/projects/:projectId/health" element={<HealthPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Helper to configure useQuery for all calls (projectScore, componentScores, trend, stability, flipHistory)
function setupQueries(opts: {
  isLoading?: boolean;
  projectScore?: { score: number; computedAt: Date } | null;
  componentScores?: Array<{
    componentId: string | null;
    componentName: string;
    score: number;
  }>;
  trendData?: Array<{ score: number; computedAt: Date }>;
  stabilityScores?: Array<{
    url: string;
    viewport: string;
    browser: string;
    parameterName: string;
    stabilityScore: number;
    flipCount: number;
    totalRuns: number;
  }>;
  flipHistory?: Array<{ passed: boolean; createdAt: string }>;
}) {
  const {
    isLoading = false,
    projectScore = null,
    componentScores = [],
    trendData = [],
    stabilityScores,
    flipHistory,
  } = opts;

  mockUseQuery.mockImplementation((options: unknown) => {
    const queryOpts = options as { queryKey?: any[] };
    const key = queryOpts?.queryKey;

    if (key?.[0] === 'stability' && key?.[1] === 'list') {
      return {
        data: stabilityScores ?? [],
        isLoading: false,
      } as ReturnType<typeof useQuery>;
    }
    if (key?.[0] === 'stability' && key?.[1] === 'flipHistory') {
      return {
        data: flipHistory ?? [],
        isLoading: false,
      } as ReturnType<typeof useQuery>;
    }

    if (key?.[1] === 'projectScore') {
      return {
        data: isLoading ? undefined : projectScore,
        isLoading,
      } as ReturnType<typeof useQuery>;
    }
    if (key?.[1] === 'componentScores') {
      return {
        data: isLoading ? undefined : componentScores,
        isLoading,
      } as ReturnType<typeof useQuery>;
    }
    if (key?.[0] === 'a11y') {
      return { data: null, isLoading: false } as ReturnType<typeof useQuery>;
    }
    if (key?.[0] === 'lighthouse' && key?.[1] === 'routeUrls') {
      return { data: [], isLoading: false } as ReturnType<typeof useQuery>;
    }
    // trend and other queries
    return {
      data: isLoading ? undefined : trendData,
      isLoading,
    } as ReturnType<typeof useQuery>;
  });

  mockUseQueries.mockReturnValue([] as ReturnType<typeof useQueries>);
}

describe('HealthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while queries are pending', () => {
    setupQueries({ isLoading: true });
    renderPage();
    expect(screen.getByText(/loading health data/i)).toBeInTheDocument();
  });

  it('shows empty state when projectScore is null', () => {
    setupQueries({ projectScore: null });
    renderPage();
    expect(screen.getByText(/no health data yet/i)).toBeInTheDocument();
  });

  it('shows "Create Schedule" link in empty state pointing to schedules page', () => {
    setupQueries({ projectScore: null });
    renderPage('proj-uuid-1');
    const link = screen.getByRole('link', { name: /create schedule/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toContain('/schedules');
  });

  it('renders health gauge with project score', () => {
    setupQueries({
      projectScore: { score: 85, computedAt: new Date() },
    });
    renderPage();
    const gauge = screen.getByTestId('health-gauge');
    expect(gauge).toBeInTheDocument();
    expect(gauge).toHaveTextContent('85');
  });

  it('renders trend chart when trend data exists', () => {
    setupQueries({
      projectScore: { score: 72, computedAt: new Date() },
      trendData: [
        { score: 70, computedAt: new Date('2026-01-01') },
        { score: 72, computedAt: new Date('2026-01-02') },
      ],
    });
    renderPage();
    expect(screen.getByTestId('health-trend-chart')).toBeInTheDocument();
  });

  it('renders component score list when components exist', () => {
    setupQueries({
      projectScore: { score: 80, computedAt: new Date() },
      componentScores: [
        { componentId: 'comp-1', componentName: 'Header', score: 90 },
        { componentId: 'comp-2', componentName: 'Footer', score: 70 },
      ],
    });
    renderPage();
    expect(screen.getByTestId('component-score-list')).toBeInTheDocument();
  });

  it('renders needs attention section for worst components', () => {
    setupQueries({
      projectScore: { score: 65, computedAt: new Date() },
      componentScores: [
        { componentId: 'comp-1', componentName: 'Nav', score: 50 },
      ],
    });
    renderPage();
    expect(screen.getByTestId('needs-attention')).toBeInTheDocument();
  });

  it('renders "Project Health" heading in data state', () => {
    setupQueries({
      projectScore: { score: 92, computedAt: new Date() },
    });
    renderPage();
    expect(screen.getByText('Project Health')).toBeInTheDocument();
  });

  it('renders stability section with scores when stability data is available', () => {
    setupQueries({
      projectScore: { score: 80, computedAt: new Date() },
      stabilityScores: [
        {
          url: 'https://example.com/home',
          viewport: '1280x720',
          browser: 'chromium',
          parameterName: '',
          stabilityScore: 40,
          flipCount: 6,
          totalRuns: 20,
        },
        {
          url: 'https://example.com/about',
          viewport: '375x812',
          browser: 'chromium',
          parameterName: '',
          stabilityScore: 70,
          flipCount: 3,
          totalRuns: 15,
        },
      ],
    });
    renderPage();
    expect(screen.getByText('Route Stability')).toBeInTheDocument();
    expect(screen.getByTestId('stability-score-list')).toBeInTheDocument();
    const rows = screen.getAllByTestId('stability-row');
    expect(rows).toHaveLength(2);
  });

  it('shows empty state when no unstable routes', () => {
    setupQueries({
      projectScore: { score: 95, computedAt: new Date() },
      stabilityScores: [],
    });
    renderPage();
    expect(screen.getByText('Route Stability')).toBeInTheDocument();
    expect(screen.getByText('No unstable routes detected')).toBeInTheDocument();
  });
});
