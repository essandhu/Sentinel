import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders title as h1', () => {
    render(<PageHeader title="Dashboard" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Dashboard');
  });

  it('renders actions slot', () => {
    render(<PageHeader title="Dashboard" actions={<button>New</button>} />);
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('does not render actions container when no actions', () => {
    const { container } = render(<PageHeader title="Dashboard" />);
    // Should just have the heading
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
