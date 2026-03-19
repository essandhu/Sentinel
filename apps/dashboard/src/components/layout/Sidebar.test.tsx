import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock trpc to avoid needing real API setup
vi.mock('../../trpc', () => ({
  trpc: {
    projects: {
      list: {
        queryOptions: () => ({
          queryKey: ['projects', 'list'],
          queryFn: () => Promise.resolve([]),
        }),
      },
    },
  },
}));

import { Sidebar } from './Sidebar';

function renderSidebar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Sidebar', () => {
  it('branding area has explicit height h-[65px] for alignment with header bar', () => {
    renderSidebar();
    const brandingText = screen.getByText('Sentinel');
    const brandingArea = brandingText.closest('div');
    expect(brandingArea).toHaveClass('h-[65px]');
  });
});
