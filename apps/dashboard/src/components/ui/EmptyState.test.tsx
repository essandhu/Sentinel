import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="No items" description="Try adjusting your filters" />);
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState title="No items" />);
    // Only title text should be present
    expect(container.textContent).toBe('No items');
  });

  it('renders Link action when "to" is provided', () => {
    render(
      <MemoryRouter>
        <EmptyState title="No items" action={{ label: 'Create one', to: '/create' }} />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Create one' });
    expect(link).toHaveAttribute('href', '/create');
  });

  it('renders button action when "onClick" is provided', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<EmptyState title="No items" action={{ label: 'Retry', onClick }} />);

    const button = screen.getByRole('button', { name: 'Retry' });
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
