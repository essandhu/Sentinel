import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NeedsAttention } from './NeedsAttention';

const makeItem = (id: string, name: string, score: number, type: 'component' | 'url' = 'component') => ({
  id,
  name,
  score,
  type,
});

describe('NeedsAttention', () => {
  it('renders nothing when items array is empty', () => {
    const { container } = render(<NeedsAttention items={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders item name, score, and type', () => {
    const items = [makeItem('1', 'LoginPage', 72, 'component')];
    render(<NeedsAttention items={items} />);

    expect(screen.getByText('LoginPage')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('component')).toBeInTheDocument();
  });

  it('renders url type items', () => {
    const items = [makeItem('1', '/checkout', 45, 'url')];
    render(<NeedsAttention items={items} />);

    expect(screen.getByText('/checkout')).toBeInTheDocument();
    expect(screen.getByText('url')).toBeInTheDocument();
  });

  it('limits display to top 5 items', () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      makeItem(String(i), `Item ${i}`, 50 + i),
    );
    render(<NeedsAttention items={items} />);

    expect(screen.getByText('Item 0')).toBeInTheDocument();
    expect(screen.getByText('Item 4')).toBeInTheDocument();
    expect(screen.queryByText('Item 5')).not.toBeInTheDocument();
  });

  it('applies danger color style for scores below 50', () => {
    const items = [makeItem('1', 'LowScore', 30)];
    render(<NeedsAttention items={items} />);

    const scoreEl = screen.getByText('30');
    expect(scoreEl.style.background).toContain('var(--s-danger-dim)');
    expect(scoreEl.style.color).toContain('var(--s-danger)');
  });

  it('applies warning color style for scores between 50 and 79', () => {
    const items = [makeItem('1', 'MidScore', 65)];
    render(<NeedsAttention items={items} />);

    const scoreEl = screen.getByText('65');
    expect(scoreEl.style.background).toContain('var(--s-warning-dim)');
    expect(scoreEl.style.color).toContain('var(--s-warning)');
  });

  it('applies success color style for scores 80 and above', () => {
    const items = [makeItem('1', 'HighScore', 95)];
    render(<NeedsAttention items={items} />);

    const scoreEl = screen.getByText('95');
    expect(scoreEl.style.background).toContain('var(--s-success-dim)');
    expect(scoreEl.style.color).toContain('var(--s-success)');
  });

  it('applies warning at boundary score of 50', () => {
    const items = [makeItem('1', 'Boundary50', 50)];
    render(<NeedsAttention items={items} />);

    const scoreEl = screen.getByText('50');
    expect(scoreEl.style.background).toContain('var(--s-warning-dim)');
  });

  it('applies success at boundary score of 80', () => {
    const items = [makeItem('1', 'Boundary80', 80)];
    render(<NeedsAttention items={items} />);

    const scoreEl = screen.getByText('80');
    expect(scoreEl.style.background).toContain('var(--s-success-dim)');
  });
});
