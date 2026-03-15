import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthGauge } from './HealthGauge';

describe('HealthGauge', () => {
  it('renders score text in SVG', () => {
    render(<HealthGauge score={75} />);
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('applies green color for score >= 80', () => {
    render(<HealthGauge score={85} />);
    const text = screen.getByText('85');
    expect(text).toHaveAttribute('fill', 'var(--s-success)');
  });

  it('applies yellow color for score >= 50', () => {
    render(<HealthGauge score={60} />);
    const text = screen.getByText('60');
    expect(text).toHaveAttribute('fill', 'var(--s-warning)');
  });

  it('applies red color for score < 50', () => {
    render(<HealthGauge score={30} />);
    const text = screen.getByText('30');
    expect(text).toHaveAttribute('fill', 'var(--s-danger)');
  });

  it('shows breakdown legend when breakdown provided', () => {
    render(
      <HealthGauge
        score={90}
        breakdown={{ visual: 95, consistency: 88, accessibility: 72 }}
      />,
    );
    expect(screen.getByTestId('health-breakdown')).toBeInTheDocument();
    expect(screen.getByText('VIS 95%')).toBeInTheDocument();
    expect(screen.getByText('CON 88%')).toBeInTheDocument();
    expect(screen.getByText('A11Y 72%')).toBeInTheDocument();
  });

  it('does not show breakdown when not provided', () => {
    render(<HealthGauge score={90} />);
    expect(screen.queryByTestId('health-breakdown')).not.toBeInTheDocument();
  });

  it('sets title tooltip from breakdown', () => {
    render(
      <HealthGauge
        score={80}
        breakdown={{ visual: 85, performance: 70 }}
      />,
    );
    const gauge = screen.getByTestId('health-gauge');
    expect(gauge).toHaveAttribute('title', 'Visual: 85%, Performance: 70%');
  });
});
