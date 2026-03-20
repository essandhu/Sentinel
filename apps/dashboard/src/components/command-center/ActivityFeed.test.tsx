import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityFeed, type ActivityItem } from './ActivityFeed';

const mockItems: ActivityItem[] = [
  { id: '1', type: 'run-completed', message: 'Run #142 completed', timestamp: new Date().toISOString() },
  { id: '2', type: 'approval', message: 'erick approved 4 diffs', timestamp: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: '3', type: 'health-change', message: 'Health dropped 94 → 91%', timestamp: new Date(Date.now() - 30 * 60000).toISOString() },
];

describe('ActivityFeed', () => {
  it('renders all activity items', () => {
    render(<ActivityFeed items={mockItems} />);

    expect(screen.getByText('Run #142 completed')).toBeInTheDocument();
    expect(screen.getByText('erick approved 4 diffs')).toBeInTheDocument();
    expect(screen.getByText('Health dropped 94 → 91%')).toBeInTheDocument();
  });

  it('displays relative timestamps', () => {
    render(<ActivityFeed items={mockItems} />);

    expect(screen.getByText('Just now')).toBeInTheDocument();
    expect(screen.getByText('5m ago')).toBeInTheDocument();
  });

  it('renders empty state when no items', () => {
    render(<ActivityFeed items={[]} />);

    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });
});
