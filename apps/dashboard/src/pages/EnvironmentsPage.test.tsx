import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../trpc', () => ({
  trpc: {
    environments: {
      list: {
        queryOptions: vi.fn(() => ({
          queryKey: ['environments', 'list'],
          queryFn: async () => [],
        })),
      },
      listRoutes: {
        queryOptions: vi.fn(() => ({
          queryKey: ['environments', 'listRoutes'],
          queryFn: async () => [],
        })),
      },
    },
  },
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

vi.mock('../components/EnvironmentSelector', () => ({
  EnvironmentSelector: ({ onSelect }: { onSelect: (s: string, t: string) => void }) => (
    <div data-testid="environment-selector">
      <button onClick={() => onSelect('staging', 'production')}>Mock Compare</button>
    </div>
  ),
}));

vi.mock('../components/EnvironmentDiffView', () => ({
  EnvironmentDiffView: () => <div data-testid="environment-diff-view" />,
}));

import { useQuery } from '@tanstack/react-query';
import { EnvironmentsPage } from './EnvironmentsPage';

const mockUseQuery = vi.mocked(useQuery);

const sampleEnvironments = [
  { id: 'env-1', name: 'staging', baseUrl: 'https://staging.example.com', isReference: 0 },
  { id: 'env-2', name: 'production', baseUrl: 'https://example.com', isReference: 1 },
];

const sampleRoutes = [
  { url: '/home', viewport: '1920x1080', browser: 'chromium' },
  { url: '/about', viewport: '1920x1080', browser: 'chromium' },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/proj-1/environments']}>
      <EnvironmentsPage />
    </MemoryRouter>,
  );
}

describe('EnvironmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and environment selector when environments exist', () => {
    // First call: environments list; subsequent calls: route lists
    mockUseQuery.mockReturnValue({
      data: sampleEnvironments,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    renderPage();
    expect(screen.getByRole('heading', { name: /environment comparison/i })).toBeInTheDocument();
    expect(screen.getByTestId('environment-selector')).toBeInTheDocument();
  });

  it('shows empty state when no environments defined', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    renderPage();
    expect(screen.getByText('No environments defined yet')).toBeInTheDocument();
  });

  it('shows loading state while fetching environments', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useQuery>);

    renderPage();
    expect(screen.getByText('Loading environments...')).toBeInTheDocument();
  });

  it('shows route table heading after environments selected', () => {
    // Return environments for the first call, routes for the subsequent calls
    mockUseQuery.mockImplementation((options: unknown) => {
      const opts = options as { queryKey?: string[] };
      if (opts?.queryKey?.[1] === 'listRoutes') {
        return {
          data: sampleRoutes,
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useQuery>;
      }
      return {
        data: sampleEnvironments,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>;
    });

    renderPage();
    // Click mock Compare to trigger onSelect via fireEvent
    fireEvent.click(screen.getByText('Mock Compare'));

    expect(screen.getByText(/routes available in both environments/i)).toBeInTheDocument();
  });
});
