import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('../trpc', () => ({
  trpc: {
    components: {
      list: {
        queryOptions: vi.fn(() => ({
          queryKey: ['components', 'list'],
          queryFn: async () => [],
        })),
      },
    },
  },
  trpcClient: {
    components: {
      create: { mutate: (...args: unknown[]) => mockCreateMutate(...args) },
      update: { mutate: (...args: unknown[]) => mockUpdateMutate(...args) },
      delete: { mutate: (...args: unknown[]) => mockDeleteMutate(...args) },
    },
  },
  queryClient: {
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  },
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  };
});

vi.mock('../components/ConsistencyMatrix', () => ({
  ConsistencyMatrix: () => <div data-testid="consistency-matrix" />,
}));

import { useQuery, useMutation } from '@tanstack/react-query';
import { ComponentsPage } from './ComponentsPage';

const mockUseQuery = vi.mocked(useQuery);
const mockUseMutation = vi.mocked(useMutation);

const sampleComponents = [
  {
    id: 'comp-1',
    projectId: 'proj-1',
    name: 'Primary Button',
    selector: '.btn-primary',
    description: 'Main action button',
    enabled: 1,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'comp-2',
    projectId: 'proj-1',
    name: 'Card',
    selector: '.card-container',
    description: null,
    enabled: 0,
    createdAt: new Date('2024-01-16'),
    updatedAt: new Date('2024-01-16'),
  },
];

function mockMutationReturn(mutateFn = vi.fn()) {
  return {
    mutate: mutateFn,
    mutateAsync: vi.fn(),
    isPending: false,
    isIdle: true,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    variables: undefined,
    reset: vi.fn(),
    context: undefined,
    failureCount: 0,
    failureReason: null,
    status: 'idle',
    submittedAt: 0,
  } as unknown as ReturnType<typeof useMutation>;
}

function setupMocks(components: typeof sampleComponents | [] = []) {
  mockUseQuery.mockReturnValue({
    data: components,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useQuery>);

  mockUseMutation.mockReturnValue(mockMutationReturn());
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/proj-1/components']}>
      <ComponentsPage />
    </MemoryRouter>,
  );
}

describe('ComponentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and add component button', () => {
    setupMocks();
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /components/i })).toBeInTheDocument();
    expect(screen.getByText('Add Component')).toBeInTheDocument();
  });

  it('renders component list when data loaded', () => {
    setupMocks(sampleComponents);
    renderPage();
    expect(screen.getByText('Primary Button')).toBeInTheDocument();
    expect(screen.getByText('.btn-primary')).toBeInTheDocument();
    expect(screen.getByText('Card')).toBeInTheDocument();
    expect(screen.getByText('.card-container')).toBeInTheDocument();
  });

  it('shows add component form when Add Component clicked', () => {
    setupMocks();
    renderPage();
    fireEvent.click(screen.getByText('Add Component'));
    expect(screen.getByText('Register Component')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Primary Button')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('.btn-primary')).toBeInTheDocument();
  });

  it('calls create mutation when form submitted with name and selector', () => {
    const mutateFn = vi.fn();
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    mockUseMutation.mockReturnValue(mockMutationReturn(mutateFn));

    renderPage();
    fireEvent.click(screen.getByText('Add Component'));

    fireEvent.change(screen.getByPlaceholderText('Primary Button'), {
      target: { value: 'My Button' },
    });
    fireEvent.change(screen.getByPlaceholderText('.btn-primary'), {
      target: { value: '.my-btn' },
    });
    fireEvent.submit(screen.getByText('Create Component'));

    expect(mutateFn).toHaveBeenCalled();
  });

  it('calls delete mutation when delete confirmed', () => {
    const mutateFn = vi.fn();
    mockUseQuery.mockReturnValue({
      data: sampleComponents,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    mockUseMutation.mockReturnValue(mockMutationReturn(mutateFn));

    renderPage();
    // Click first Delete button
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    // Click Confirm
    fireEvent.click(screen.getByText('Confirm'));
    expect(mutateFn).toHaveBeenCalled();
  });

  it('calls update mutation when toggle clicked', () => {
    const mutateFn = vi.fn();
    mockUseQuery.mockReturnValue({
      data: sampleComponents,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    mockUseMutation.mockReturnValue(mockMutationReturn(mutateFn));

    renderPage();
    const toggleButtons = screen.getAllByTitle(/enable|disable/i);
    fireEvent.click(toggleButtons[0]);
    expect(mutateFn).toHaveBeenCalled();
  });

  it('shows empty state when no components', () => {
    setupMocks([]);
    renderPage();
    expect(screen.getByText('No components registered')).toBeInTheDocument();
  });

  it('renders consistency matrix section', () => {
    setupMocks();
    renderPage();
    expect(screen.getByText('Consistency Matrix')).toBeInTheDocument();
    expect(screen.getByTestId('consistency-matrix')).toBeInTheDocument();
  });
});
