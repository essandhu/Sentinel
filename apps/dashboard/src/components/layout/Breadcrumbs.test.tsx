import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Breadcrumbs } from './Breadcrumbs';

// Mock trpc and react-query (Breadcrumbs uses useQuery + trpc.projects.list)
vi.mock('../../trpc', () => ({
  trpc: {
    projects: {
      list: {
        queryOptions: vi.fn(() => ({ queryKey: ['projects', 'list'], queryFn: async () => [] })),
      },
    },
  },
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: [], isLoading: false })),
  };
});

function TestPage() {
  return (
    <div>
      <Breadcrumbs />
      <div data-testid="page-content">Page Content</div>
    </div>
  );
}

function createRouterWithCrumbs(initialPath: string) {
  return createMemoryRouter(
    [
      {
        path: '/',
        handle: { crumb: 'Runs' },
        element: <TestPage />,
      },
      {
        path: '/settings',
        handle: { crumb: 'Settings' },
        element: <TestPage />,
      },
      {
        path: '/projects/:projectId',
        handle: { crumb: (params: Record<string, string>) => `Project ${params.projectId.slice(0, 8)}` },
        children: [
          {
            path: 'health',
            handle: { crumb: 'Health' },
            element: <TestPage />,
          },
          {
            path: 'components',
            handle: { crumb: 'Components' },
            element: <TestPage />,
          },
        ],
      },
    ],
    { initialEntries: [initialPath] }
  );
}

describe('Breadcrumbs', () => {
  it('renders a single crumb for top-level route', () => {
    const router = createRouterWithCrumbs('/');
    render(<RouterProvider router={router} />);
    expect(screen.getByText('Runs')).toBeInTheDocument();
  });

  it('renders nested crumbs with separator for project routes', () => {
    const router = createRouterWithCrumbs('/projects/abc12345def/health');
    render(<RouterProvider router={router} />);
    expect(screen.getByText('Project abc12345')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
  });

  it('renders intermediate crumbs as links', () => {
    const router = createRouterWithCrumbs('/projects/abc12345def/components');
    render(<RouterProvider router={router} />);
    // The project crumb should be a link (intermediate), components should not (last)
    const projectCrumb = screen.getByText('Project abc12345');
    expect(projectCrumb.closest('a') || projectCrumb.tagName === 'A').toBeTruthy();
  });

  it('renders last crumb as plain text (not a link)', () => {
    const router = createRouterWithCrumbs('/projects/abc12345def/health');
    render(<RouterProvider router={router} />);
    const healthCrumb = screen.getByText('Health');
    expect(healthCrumb.closest('a')).toBeNull();
    expect(healthCrumb.tagName).not.toBe('A');
  });

  it('renders separator between crumbs', () => {
    const router = createRouterWithCrumbs('/projects/abc12345def/health');
    const { container } = render(<RouterProvider router={router} />);
    // Separator is now an SVG chevron, not a "/" character
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });
});
