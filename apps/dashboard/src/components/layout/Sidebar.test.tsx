import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock trpc
vi.mock('../../trpc', () => ({
  trpc: {
    projects: {
      list: {
        queryOptions: vi.fn(() => ({ queryKey: ['projects', 'list'], queryFn: async () => [] })),
      },
    },
  },
}));

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
  };
});

import { Sidebar } from './Sidebar';

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Command Center" nav link', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /command center/i })).toBeInTheDocument();
  });

  it('renders "Runs" nav link', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /runs/i })).toBeInTheDocument();
  });
});
