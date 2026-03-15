import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthTrendChart } from './HealthTrendChart';

vi.mock('recharts', () => ({
  AreaChart: ({ children, ...props }: any) => <div data-testid="area-chart">{children}</div>,
  Area: (props: any) => <div data-testid="area" />,
  XAxis: (props: any) => <div data-testid="x-axis" />,
  YAxis: (props: any) => <div data-testid="y-axis" />,
  CartesianGrid: (props: any) => <div data-testid="cartesian-grid" />,
  Tooltip: (props: any) => <div data-testid="tooltip" />,
  ReferenceArea: (props: any) => <div data-testid="reference-area" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

describe('HealthTrendChart', () => {
  const sampleData = [
    { date: '2026-03-01', score: 85 },
    { date: '2026-03-02', score: 88 },
  ];

  it('renders area chart', () => {
    render(<HealthTrendChart data={sampleData} />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('area')).toBeInTheDocument();
  });

  it('renders chart axes and grid', () => {
    render(<HealthTrendChart data={sampleData} />);
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
  });

  it('renders reference areas for score bands', () => {
    render(<HealthTrendChart data={sampleData} />);
    const refAreas = screen.getAllByTestId('reference-area');
    expect(refAreas.length).toBe(3);
  });
});
