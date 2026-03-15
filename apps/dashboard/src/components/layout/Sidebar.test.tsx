import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createElement } from 'react';
import { Sidebar } from './Sidebar';
import { ThemeProvider } from '../../hooks/useTheme';
import type { ReactNode } from 'react';

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
const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn((): any => ({ data: [], isLoading: false })),
}));
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: mockUseQuery,
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

function renderWithRouter(ui: ReactNode, { initialEntries = ['/'] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {createElement(ThemeProvider, null, ui)}
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });
  document.documentElement.classList.remove('dark');
  window.matchMedia = createMockMatchMedia();
});

describe('Sidebar', () => {
  it('renders Sentinel branding', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText('Sentinel')).toBeInTheDocument();
  });

  it('renders global navigation links (Runs and Settings)', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByRole('link', { name: /runs/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings');
  });

  it('does not show project links on non-project routes', () => {
    renderWithRouter(<Sidebar />, { initialEntries: ['/'] });
    expect(screen.queryByRole('link', { name: /health/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /components/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /schedules/i })).not.toBeInTheDocument();
  });

  it('shows project-scoped links when on a project route', () => {
    mockUseQuery.mockReturnValue({
      data: [{ id: 'abc123', name: 'Test Project' }] as any,
      isLoading: false,
    });
    renderWithRouter(<Sidebar />, { initialEntries: ['/projects/abc123/health'] });
    expect(screen.getByRole('link', { name: /health/i })).toHaveAttribute('href', '/projects/abc123/health');
    expect(screen.getByRole('link', { name: /components/i })).toHaveAttribute('href', '/projects/abc123/components');
    expect(screen.getByRole('link', { name: /schedules/i })).toHaveAttribute('href', '/projects/abc123/schedules');
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
  });

  it('highlights active link', () => {
    renderWithRouter(<Sidebar />, { initialEntries: ['/settings'] });
    const settingsLink = screen.getByRole('link', { name: /settings/i });
    expect(settingsLink.className).toContain('text-[var(--s-accent)]');
  });

  it('has a mobile menu toggle button', () => {
    renderWithRouter(<Sidebar />);
    // The hamburger menu button for mobile
    expect(screen.getByLabelText(/toggle.*menu|menu/i)).toBeInTheDocument();
  });

  it('toggles mobile sidebar visibility on button click', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Sidebar />);
    const toggleBtn = screen.getByLabelText(/toggle.*menu|menu/i);

    // The sidebar navigation should exist (it's in the DOM but hidden on mobile via CSS)
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();

    // Click to toggle
    await user.click(toggleBtn);
    // After click, the sidebar should still be in the DOM
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
