import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusStrip } from './StatusStrip';

const defaultData = {
  healthScore: 94,
  healthTrend: 2,
  pendingDiffs: 7,
  lastRunTime: new Date().toISOString(),
  lastRunPassed: true,
  newRegressions: 3,
  regressionTrend: -1,
};

describe('StatusStrip', () => {
  it('renders four metric cards (Health, Pending, Last Run, Regressions)', () => {
    render(<StatusStrip data={defaultData} />);
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Last Run')).toBeInTheDocument();
    expect(screen.getByText('Regressions')).toBeInTheDocument();
  });

  it('displays health score value', () => {
    render(<StatusStrip data={defaultData} />);
    expect(screen.getByText('94')).toBeInTheDocument();
  });

  it('displays pending diff count', () => {
    render(<StatusStrip data={defaultData} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows positive health trend with "+2"', () => {
    render(<StatusStrip data={defaultData} />);
    const trend = screen.getByTestId('health-trend');
    expect(trend).toHaveTextContent('+2');
  });

  it('shows negative regression trend with "-1"', () => {
    render(<StatusStrip data={defaultData} />);
    const trend = screen.getByTestId('regression-trend');
    expect(trend).toHaveTextContent('-1');
  });

  it('renders each card with proper padding via s-card-elevated class and p-4', () => {
    const { container } = render(<StatusStrip data={defaultData} />);
    const cards = container.querySelectorAll('.s-card-elevated');
    expect(cards).toHaveLength(4);
    cards.forEach((card) => {
      expect(card.className).toContain('p-4');
    });
  });
});
