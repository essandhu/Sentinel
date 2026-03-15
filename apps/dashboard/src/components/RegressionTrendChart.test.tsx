import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: (props: any) => <div data-testid={`bar-${props.dataKey}`} data-fill={props.fill} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

import { RegressionTrendChart } from './RegressionTrendChart';

describe('RegressionTrendChart', () => {
  const sampleData = [
    { date: '2026-03-08', count: 3 },
    { date: '2026-03-09', count: 1 },
    { date: '2026-03-10', count: 5 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bar chart with sample data', () => {
    render(<RegressionTrendChart data={sampleData} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar-count')).toBeInTheDocument();
  });

  it('renders chart axes and grid', () => {
    render(<RegressionTrendChart data={sampleData} />);
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
  });

  it('uses theme danger color for bars', () => {
    render(<RegressionTrendChart data={sampleData} />);
    const bar = screen.getByTestId('bar-count');
    expect(bar.getAttribute('data-fill')).toBe('var(--s-danger)');
  });

  it('renders tooltip', () => {
    render(<RegressionTrendChart data={sampleData} />);
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });
});
