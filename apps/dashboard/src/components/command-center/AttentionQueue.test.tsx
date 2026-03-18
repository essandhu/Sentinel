import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttentionQueue, type AttentionItem } from './AttentionQueue';

const mockItems: AttentionItem[] = [
  { id: '1', type: 'failing-diff', title: '3 failing diffs', description: 'homepage, about, contact', priority: 'critical', count: 3 },
  { id: '2', type: 'regression', title: '2 new regressions', description: 'Header component', priority: 'warning', count: 2 },
  { id: '3', type: 'run-complete', title: 'Run #142 completed', description: '12 diffs, all passed', priority: 'info', count: 0 },
];

describe('AttentionQueue', () => {
  it('renders all attention items', () => {
    const onItemClick = vi.fn();
    render(<AttentionQueue items={mockItems} onItemClick={onItemClick} />);

    expect(screen.getByText('3 failing diffs')).toBeInTheDocument();
    expect(screen.getByText('2 new regressions')).toBeInTheDocument();
    expect(screen.getByText('Run #142 completed')).toBeInTheDocument();
  });

  it('critical item has s-priority-critical class', () => {
    const onItemClick = vi.fn();
    render(<AttentionQueue items={mockItems} onItemClick={onItemClick} />);

    const items = screen.getAllByTestId('attention-item');
    const criticalItem = items.find(el => el.textContent?.includes('3 failing diffs'));
    expect(criticalItem).toHaveClass('s-priority-critical');
  });

  it('calls onItemClick when item is clicked', () => {
    const onItemClick = vi.fn();
    render(<AttentionQueue items={mockItems} onItemClick={onItemClick} />);

    const firstItem = screen.getAllByTestId('attention-item')[0];
    fireEvent.click(firstItem);

    expect(onItemClick).toHaveBeenCalledWith(mockItems[0]);
  });

  it('calls onItemClick on Enter keydown', () => {
    const onItemClick = vi.fn();
    render(<AttentionQueue items={mockItems} onItemClick={onItemClick} />);

    const firstItem = screen.getAllByTestId('attention-item')[0];
    fireEvent.keyDown(firstItem, { key: 'Enter' });

    expect(onItemClick).toHaveBeenCalledWith(mockItems[0]);
  });

  it('renders empty state when no items', () => {
    const onItemClick = vi.fn();
    render(<AttentionQueue items={[]} onItemClick={onItemClick} />);

    expect(screen.getByTestId('attention-empty')).toBeInTheDocument();
    expect(screen.getByText('Nothing needs attention')).toBeInTheDocument();
  });

  it('shows count for items with count > 0', () => {
    const onItemClick = vi.fn();
    render(<AttentionQueue items={mockItems} onItemClick={onItemClick} />);

    // Items with count > 0 should display the count
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
