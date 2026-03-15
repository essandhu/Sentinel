import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlipHistoryChart } from './FlipHistoryChart';

vi.mock('recharts', () => ({
  AreaChart: ({ children, ...props }: any) => <div data-testid="area-chart" {...props}>{children}</div>,
  Area: (props: any) => <div data-testid="area" />,
  XAxis: (props: any) => <div data-testid="x-axis" />,
  YAxis: (props: any) => <div data-testid="y-axis" />,
  CartesianGrid: (props: any) => <div data-testid="cartesian-grid" />,
  Tooltip: (props: any) => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

describe('FlipHistoryChart', () => {
  const sampleData = [
    { passed: true, createdAt: '2026-03-01T00:00:00Z' },
    { passed: false, createdAt: '2026-03-02T00:00:00Z' },
  ];

  it('renders route label', () => {
    render(<FlipHistoryChart data={sampleData} routeLabel="Home / 1920x1080" />);
    expect(screen.getByText('Home / 1920x1080')).toBeInTheDocument();
  });

  it('renders chart container', () => {
    render(<FlipHistoryChart data={sampleData} routeLabel="Home" />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });
});
