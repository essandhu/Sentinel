import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PerformanceScoreChart } from './PerformanceScoreChart';

// Mock recharts to inspect rendered components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: (props: any) => <div data-testid={`area-${props.dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ReferenceArea: (props: any) => <div data-testid={`reference-area-${props.y1}-${props.y2}`} />,
  ReferenceLine: (props: any) => (
    <div
      data-testid="reference-line"
      data-y={props.y}
      data-stroke={props.stroke}
      data-label={typeof props.label === 'object' ? props.label.value : props.label}
    />
  ),
}));

// Mock tRPC - vi.hoisted ensures these are available before vi.mock runs
const { mockBudgetData, mockTrendData } = vi.hoisted(() => ({
  mockBudgetData: [] as any[],
  mockTrendData: [] as any[],
}));

vi.mock('../trpc', () => ({
  trpc: {
    lighthouse: {
      trend: {
        queryOptions: (input: any) => ({
          queryKey: ['lighthouse', 'trend', input],
          queryFn: () => mockTrendData,
        }),
      },
      budgetsList: {
        queryOptions: (input: any) => ({
          queryKey: ['lighthouse', 'budgetsList', input],
          queryFn: () => mockBudgetData,
        }),
      },
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('PerformanceScoreChart', () => {
  beforeEach(() => {
    mockBudgetData.length = 0;
    mockTrendData.length = 0;
    mockTrendData.push(
      { createdAt: '2026-01-01', performance: 85, accessibility: 90, bestPractices: 80, seo: 95 },
    );
  });

  it('renders a dashed red ReferenceLine at budget threshold when budget exists for the route', async () => {
    mockBudgetData.push({ route: '/', performance: 90, accessibility: null, bestPractices: null, seo: null });

    render(
      <PerformanceScoreChart projectId="proj-1" routeUrls={['/']} />,
      { wrapper: createWrapper() },
    );

    // Wait for data to load
    const refLine = await screen.findByTestId('reference-line');
    expect(refLine).toBeInTheDocument();
    expect(refLine).toHaveAttribute('data-y', '90');
    expect(refLine).toHaveAttribute('data-stroke', 'var(--s-danger)');
    expect(refLine).toHaveAttribute('data-label', expect.stringContaining('Budget'));
  });

  it('does not render ReferenceLine when no budget exists for the route', async () => {
    // No budgets configured
    mockBudgetData.length = 0;

    render(
      <PerformanceScoreChart projectId="proj-1" routeUrls={['/']} />,
      { wrapper: createWrapper() },
    );

    // Wait for chart to render
    await screen.findByTestId('area-chart');

    expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument();
  });

  it('renders ReferenceLine with label showing Budget: {value}', async () => {
    mockBudgetData.push({ route: '/about', performance: 75, accessibility: null, bestPractices: null, seo: null });

    render(
      <PerformanceScoreChart projectId="proj-1" routeUrls={['/about']} />,
      { wrapper: createWrapper() },
    );

    const refLine = await screen.findByTestId('reference-line');
    expect(refLine).toHaveAttribute('data-label', 'Budget: 75');
  });
});
