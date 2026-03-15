import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sparkline } from './Sparkline';

vi.mock('recharts', () => ({
  LineChart: ({ children, ...props }: any) => (
    <div data-testid="line-chart" data-width={props.width} data-height={props.height}>
      {children}
    </div>
  ),
  Line: (props: any) => <div data-testid="line" data-stroke={props.stroke} />,
}));

describe('Sparkline', () => {
  it('renders without crashing', () => {
    render(<Sparkline data={[{ score: 80 }, { score: 85 }, { score: 90 }]} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();
  });

  it('uses default dimensions when not specified', () => {
    render(<Sparkline data={[{ score: 50 }]} />);
    const chart = screen.getByTestId('line-chart');
    expect(chart).toHaveAttribute('data-width', '80');
    expect(chart).toHaveAttribute('data-height', '24');
  });
});
