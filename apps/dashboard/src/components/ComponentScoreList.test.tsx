import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentScoreList } from './ComponentScoreList';

vi.mock('./Sparkline', () => ({
  Sparkline: (props: { color?: string }) => (
    <div data-testid="sparkline" data-color={props.color} />
  ),
}));

describe('ComponentScoreList', () => {
  it('renders empty state when no components', () => {
    render(<ComponentScoreList components={[]} />);
    expect(screen.getByText('No component data')).toBeInTheDocument();
  });

  it('renders component list with scores', () => {
    const components = [
      { componentId: '1', componentName: 'Button', score: 92, trend: [{ score: 90 }, { score: 92 }] },
      { componentId: '2', componentName: 'Header', score: 65, trend: [{ score: 60 }, { score: 65 }] },
    ];
    render(<ComponentScoreList components={components} />);

    expect(screen.getByText('Button')).toBeInTheDocument();
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('92')).toBeInTheDocument();
    expect(screen.getByText('65')).toBeInTheDocument();
    expect(screen.getAllByTestId('sparkline')).toHaveLength(2);
  });

  it('applies correct badge colors for score ranges', () => {
    const components = [
      { componentId: '1', componentName: 'Good', score: 85, trend: [] },
      { componentId: '2', componentName: 'Mid', score: 55, trend: [] },
      { componentId: '3', componentName: 'Bad', score: 30, trend: [] },
    ];
    render(<ComponentScoreList components={components} />);

    const badge85 = screen.getByText('85');
    const badge55 = screen.getByText('55');
    const badge30 = screen.getByText('30');

    expect(badge85.style.background).toContain('var(--s-success-dim)');
    expect(badge55.style.background).toContain('var(--s-warning-dim)');
    expect(badge30.style.background).toContain('var(--s-danger-dim)');
  });
});
