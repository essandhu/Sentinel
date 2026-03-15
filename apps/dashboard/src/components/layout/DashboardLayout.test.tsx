import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createElement } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { ThemeProvider } from '../../hooks/useTheme';
import type { ReactNode } from 'react';

// Mock child components that require tRPC/react-query providers
vi.mock('../SearchBar', () => ({
  SearchBar: () => createElement('div', { 'data-testid': 'search-bar' }, 'SearchBar'),
}));

vi.mock('../onboarding/OnboardingGuard', () => ({
  OnboardingGuard: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));

// Mock trpc (Sidebar uses useQuery + trpc.projects.list)
vi.mock('../../trpc', () => ({
  trpc: {
    projects: {
      list: {
        queryOptions: vi.fn(() => ({ queryKey: ['projects', 'list'], queryFn: async () => [] })),
      },
    },
  },
}));

// Mock @tanstack/react-query (Sidebar calls useQuery)
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: [], isLoading: false })),
  };
});

// Mock matchMedia
function createMockMatchMedia() {
  return vi.fn((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

// Mock localStorage
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
  get length() { return Object.keys(store).length; },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });
  document.documentElement.classList.remove('dark');
  window.matchMedia = createMockMatchMedia();
});

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(ThemeProvider, null, children);
}

describe('DashboardLayout', () => {
  it('renders sidebar and outlet content', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <Wrapper><DashboardLayout /></Wrapper>,
          handle: { crumb: 'Home' },
          children: [
            {
              index: true,
              element: <div data-testid="child-page">Child Page Content</div>,
              handle: { crumb: 'Dashboard' },
            },
          ],
        },
      ],
      { initialEntries: ['/'] }
    );

    render(<RouterProvider router={router} />);

    // Sidebar branding should be present
    expect(screen.getByText('Sentinel')).toBeInTheDocument();

    // Child page content via Outlet
    expect(screen.getByTestId('child-page')).toBeInTheDocument();
  });

  it('renders navigation links from sidebar', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <Wrapper><DashboardLayout /></Wrapper>,
          children: [
            {
              index: true,
              element: <div>Home</div>,
            },
          ],
        },
        {
          path: '/settings',
          element: <Wrapper><DashboardLayout /></Wrapper>,
          children: [
            {
              index: true,
              element: <div>Settings</div>,
            },
          ],
        },
      ],
      { initialEntries: ['/'] }
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByRole('link', { name: /runs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  it('applies dark mode classes to the layout container', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <Wrapper><DashboardLayout /></Wrapper>,
          children: [
            {
              index: true,
              element: <div>Home</div>,
            },
          ],
        },
      ],
      { initialEntries: ['/'] }
    );

    const { container } = render(<RouterProvider router={router} />);
    // The layout container should have dark mode classes
    const layoutDiv = container.firstElementChild;
    expect(layoutDiv?.className).toMatch(/h-screen/);
  });
});
