import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { StabilityScoreList } from './StabilityScoreList';

const makeEntry = (overrides: Partial<{
  url: string;
  viewport: string;
  browser: string;
  parameterName: string;
  stabilityScore: number;
  flipCount: number;
  totalRuns: number;
}> = {}) => ({
  url: 'https://example.com',
  viewport: '1920x1080',
  browser: 'chrome',
  parameterName: '',
  stabilityScore: 75,
  flipCount: 3,
  totalRuns: 20,
  ...overrides,
});

describe('StabilityScoreList', () => {
  it('renders empty state when no scores', () => {
    render(<StabilityScoreList scores={[]} />);
    expect(screen.getByText('No unstable routes detected')).toBeInTheDocument();
  });

  it('renders table with scores sorted worst-first', () => {
    const scores = [
      makeEntry({ url: 'https://a.com', stabilityScore: 90 }),
      makeEntry({ url: 'https://b.com', stabilityScore: 40 }),
      makeEntry({ url: 'https://c.com', stabilityScore: 70 }),
    ];
    render(<StabilityScoreList scores={scores} />);

    const rows = screen.getAllByRole('row');
    // First row is header, data rows follow
    const cells = rows.slice(1).map((row) => row.textContent);
    // Worst first: 40, 70, 90
    expect(cells[0]).toContain('40');
    expect(cells[1]).toContain('70');
    expect(cells[2]).toContain('90');
  });

  it('formats route labels correctly', () => {
    const scores = [
      makeEntry({ url: 'https://example.com', viewport: '1920x1080', parameterName: 'dark-mode' }),
    ];
    render(<StabilityScoreList scores={scores} />);
    expect(screen.getByText('https://example.com / 1920x1080 / dark-mode')).toBeInTheDocument();
  });

  it('formats route label without parameterName', () => {
    const scores = [
      makeEntry({ url: 'https://example.com', viewport: '1920x1080', parameterName: '' }),
    ];
    render(<StabilityScoreList scores={scores} />);
    expect(screen.getByText('https://example.com / 1920x1080')).toBeInTheDocument();
  });

  it('calls onSelectRoute when row clicked', () => {
    const onSelectRoute = vi.fn();
    const entry = makeEntry();
    render(<StabilityScoreList scores={[entry]} onSelectRoute={onSelectRoute} />);

    const dataRow = screen.getAllByRole('row')[1];
    fireEvent.click(dataRow);
    expect(onSelectRoute).toHaveBeenCalledWith(entry);
  });

  it('applies correct badge colors for score ranges', () => {
    const scores = [
      makeEntry({ url: 'https://green.com', stabilityScore: 85 }),
      makeEntry({ url: 'https://yellow.com', stabilityScore: 60 }),
      makeEntry({ url: 'https://red.com', stabilityScore: 30 }),
    ];
    render(<StabilityScoreList scores={scores} />);

    const badge85 = screen.getByText('85');
    const badge60 = screen.getByText('60');
    const badge30 = screen.getByText('30');

    expect(badge85.style.background).toContain('var(--s-success-dim)');
    expect(badge60.style.background).toContain('var(--s-warning-dim)');
    expect(badge30.style.background).toContain('var(--s-danger-dim)');
  });
});
