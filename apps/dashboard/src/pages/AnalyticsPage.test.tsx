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
      trend: {
        queryOptions: vi.fn((opts: any) => ({
          queryKey: ['healthScores', 'trend', opts.projectId, opts.windowDays],
          queryFn: async () => [],
        })),
      },
    },
    analytics: {
      regressionTrend: {
        queryOptions: vi.fn((opts: any) => ({
          queryKey: ['analytics', 'regressionTrend', opts.projectId, opts.windowDays],
          queryFn: async () => [],
        })),
      },
      teamMetrics: {
        queryOptions: vi.fn((opts: any) => ({
          queryKey: ['analytics', 'teamMetrics', opts.projectId, opts.windowDays],
          queryFn: async () => null,
        })),
      },
      diffExport: {
        queryOptions: vi.fn((opts: any) => ({
          queryKey: ['analytics', 'diffExport', opts.projectId, opts.windowDays],
          queryFn: async () => [],
        })),
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

// Mock export libs
vi.mock('../lib/export-pdf', () => ({
  generateProjectReport: vi.fn(),
}));

vi.mock('../lib/export-csv', () => ({
  generateCsv: vi.fn(() => ''),
  downloadCsv: vi.fn(),
}));

// Mock ExportButton to simplify AnalyticsPage tests
vi.mock('../components/ExportButton', () => ({
  ExportButton: (props: any) => (
    <div data-testid="export-button">
      <button onClick={props.onExportPdf}>PDF</button>
      <button onClick={props.onExportCsv}>CSV</button>
    </div>
  ),
}));

// Mock sub-components to avoid Recharts SVG issues in jsdom
vi.mock('../components/HealthTrendChart', () => ({
  HealthTrendChart: () => <div data-testid="health-trend-chart" />,
}));

vi.mock('../components/RegressionTrendChart', () => ({
  RegressionTrendChart: () => <div data-testid="regression-trend-chart" />,
}));

vi.mock('../components/TeamMetricsCard', () => ({
  TeamMetricsCard: (props: any) => (
    <div data-testid="team-metrics-card">
      {props.totalApprovals}
    </div>
  ),
}));

import { useQuery } from '@tanstack/react-query';
import { AnalyticsPage } from './AnalyticsPage';

const mockUseQuery = vi.mocked(useQuery);

function renderPage(projectId = 'proj-uuid-1') {
  return render(
    <MemoryRouter initialEntries={[`/projects/${projectId}/analytics`]}>
      <Routes>
        <Route path="/projects/:projectId/analytics" element={<AnalyticsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while queries are pending', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useQuery>);

    renderPage();
    expect(screen.getByText(/loading analytics/i)).toBeInTheDocument();
  });

  it('renders all chart components when data is loaded', () => {
    mockUseQuery.mockImplementation((options: unknown) => {
      const queryOpts = options as { queryKey?: any[] };
      const key = queryOpts?.queryKey;

      if (key?.[0] === 'analytics' && key?.[1] === 'teamMetrics') {
        return {
          data: { meanTimeToApproveMs: 3600000, approvalVelocity: 1, totalApprovals: 30 },
          isLoading: false,
        } as ReturnType<typeof useQuery>;
      }
      if (key?.[0] === 'analytics' && key?.[1] === 'regressionTrend') {
        return {
          data: [{ date: '2026-03-10', count: 2 }],
          isLoading: false,
        } as ReturnType<typeof useQuery>;
      }
      if (key?.[0] === 'analytics' && key?.[1] === 'diffExport') {
        return {
          data: [],
          isLoading: false,
        } as ReturnType<typeof useQuery>;
      }
      // healthScores trend - returns { computedAt, score }
      return {
        data: [{ computedAt: new Date('2026-03-10'), score: 85 }],
        isLoading: false,
      } as ReturnType<typeof useQuery>;
    });

    renderPage();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByTestId('health-trend-chart')).toBeInTheDocument();
    expect(screen.getByTestId('regression-trend-chart')).toBeInTheDocument();
    expect(screen.getByTestId('team-metrics-card')).toBeInTheDocument();
  });

  it('renders 7d date range button', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useQuery>);

    renderPage();
    expect(screen.getByText('7d')).toBeInTheDocument();
  });

  it('renders export bar', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useQuery>);

    renderPage();
    expect(screen.getByTestId('export-bar')).toBeInTheDocument();
  });
});
