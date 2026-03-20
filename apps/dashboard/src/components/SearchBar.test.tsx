import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ projectId: '00000000-0000-4000-a000-000000000001' }),
}));

// Track the last query options passed to useQuery
let lastQueryOptions: any = null;
let mockData: any = undefined;

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => {
    lastQueryOptions = opts;
    return { data: mockData, isLoading: false };
  },
}));

// Mock trpc
vi.mock('../trpc', () => ({
  useTRPC: () => ({
    projects: {
      list: {
        queryOptions: () => ({
          queryKey: ['projects', 'list'],
        }),
      },
    },
    search: {
      query: {
        queryOptions: (input: any) => ({
          queryKey: ['search', input],
          enabled: input.q.length >= 2,
          _input: input,
        }),
      },
    },
  }),
}));

import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    lastQueryOptions = null;
    mockData = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a search input', () => {
    render(createElement(SearchBar));
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('debounces input by 300ms', async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    render(createElement(SearchBar));

    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'log');

    // Input should reflect typed value
    expect(input).toHaveValue('log');
  });

  it('shows "No results" when query >= 2 chars but results empty', async () => {
    mockData = { routes: [], components: [], diffs: [] };

    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });

    render(createElement(SearchBar));
    const input = screen.getByPlaceholderText(/search/i);

    await user.type(input, 'xyz');

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  it('shows branch and project info for run results', async () => {
    mockData = {
      routes: [],
      components: [],
      diffs: [],
      runs: [
        { id: 'r1', status: 'completed', suiteName: 'critical', branchName: 'feat/login', createdAt: Date.now(), projectName: 'my-app' },
      ],
    };

    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });

    render(createElement(SearchBar));
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'login');

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Primary line should show branch name
    expect(screen.getByText('feat/login')).toBeInTheDocument();
    // Secondary line should show project name
    expect(screen.getByText(/my-app/)).toBeInTheDocument();
  });

  it('shows results when data is available', async () => {
    mockData = {
      routes: [{ url: '/login', runId: 'run-1' }],
      components: [{ id: 'c1', name: 'LoginForm' }],
      diffs: [],
    };

    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });

    render(createElement(SearchBar));
    const input = screen.getByPlaceholderText(/search/i);

    await user.type(input, 'login');

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText('/login')).toBeInTheDocument();
    expect(screen.getByText('LoginForm')).toBeInTheDocument();
  });
});
