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

  it('has flex-1 on root for proper spacing in flex parent', () => {
    const { container } = render(<PageHeader title="Dashboard" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('flex-1');
  });

  it('has gap-3 between title and actions', () => {
    const { container } = render(<PageHeader title="Test" actions={<button>Act</button>} />);
    const wrapper = container.firstElementChild!;
    expect(wrapper.className).toContain('gap-3');
  });

  it('does not render actions container when no actions', () => {
    const { container } = render(<PageHeader title="Dashboard" />);
    // Should just have the heading
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
