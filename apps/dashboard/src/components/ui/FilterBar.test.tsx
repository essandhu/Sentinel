import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  const filters = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: null, label: 'All' },
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
      selected: null as string | null,
      onChange: vi.fn(),
    },
  ];

  it('renders filter labels', () => {
    render(<FilterBar filters={filters} />);
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders all filter options as buttons', () => {
    render(<FilterBar filters={filters} />);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inactive' })).toBeInTheDocument();
  });

  it('calls onChange when option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const testFilters = [{ ...filters[0], onChange }];
    render(<FilterBar filters={testFilters} />);

    await user.click(screen.getByRole('button', { name: 'Active' }));
    expect(onChange).toHaveBeenCalledWith('active');
  });

  it('highlights selected option', () => {
    const selectedFilters = [{ ...filters[0], selected: 'active' }];
    render(<FilterBar filters={selectedFilters} />);

    const activeBtn = screen.getByRole('button', { name: 'Active' });
    expect(activeBtn.className).toContain('s-pill-active');
  });
});
