import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockCreateMutate = vi.fn();
const mockToggleMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('../trpc', () => ({
  trpc: {
    schedules: {
      list: {
        queryOptions: vi.fn(() => ({
          queryKey: ['schedules', 'list'],
          queryFn: async () => [],
        })),
      },
      history: {
        queryOptions: vi.fn(() => ({
          queryKey: ['schedules', 'history'],
          queryFn: async () => [],
        })),
      },
    },
  },
  trpcClient: {
    schedules: {
      create: { mutate: (...args: unknown[]) => mockCreateMutate(...args) },
      toggle: { mutate: (...args: unknown[]) => mockToggleMutate(...args) },
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

import { useQuery, useMutation } from '@tanstack/react-query';
import { SchedulesPage } from './SchedulesPage';

const mockUseQuery = vi.mocked(useQuery);
const mockUseMutation = vi.mocked(useMutation);

const sampleSchedules = [
  {
    id: 'sched-1',
    projectId: 'proj-1',
    name: 'Nightly Capture',
    cronExpression: '0 3 * * *',
    cronDescription: 'Daily at 3 AM',
    timezone: 'UTC',
    configPath: 'sentinel.config.json',
    enabled: 1,
    lastRunAt: '2024-01-15T03:00:00Z',
    lastRunStatus: 'completed',
    nextRun: '2024-01-16T03:00:00Z',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'sched-2',
    projectId: 'proj-1',
    name: 'Weekly Check',
    cronExpression: '0 9 * * 1',
    cronDescription: 'Weekly Monday 9 AM',
    timezone: 'America/New_York',
    configPath: 'weekly.config.json',
    enabled: 0,
    lastRunAt: null,
    lastRunStatus: null,
    nextRun: null,
    createdAt: new Date('2024-01-12'),
    updatedAt: new Date('2024-01-12'),
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

function setupMocks(schedules: typeof sampleSchedules | [] = []) {
  mockUseQuery.mockReturnValue({
    data: schedules,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useQuery>);

  mockUseMutation.mockReturnValue(mockMutationReturn());
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/proj-1/schedules']}>
      <SchedulesPage />
    </MemoryRouter>,
  );
}

describe('SchedulesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and create schedule button', () => {
    setupMocks();
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /schedules/i })).toBeInTheDocument();
    expect(screen.getByText('Create Schedule')).toBeInTheDocument();
  });

  it('renders schedule list when data loaded', () => {
    setupMocks(sampleSchedules);
    renderPage();
    expect(screen.getByText('Nightly Capture')).toBeInTheDocument();
    expect(screen.getByText('Daily at 3 AM')).toBeInTheDocument();
    expect(screen.getByText('Weekly Check')).toBeInTheDocument();
    expect(screen.getByText('Weekly Monday 9 AM')).toBeInTheDocument();
  });

  it('shows create form when Create Schedule clicked', () => {
    setupMocks();
    renderPage();
    fireEvent.click(screen.getByText('Create Schedule'));
    expect(screen.getByText('New Schedule')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nightly Capture')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0 3 * * *')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('sentinel.config.json')).toBeInTheDocument();
  });

  it('calls create mutation when form submitted', () => {
    const mutateFn = vi.fn();
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    mockUseMutation.mockReturnValue(mockMutationReturn(mutateFn));

    renderPage();
    fireEvent.click(screen.getByText('Create Schedule'));

    fireEvent.change(screen.getByPlaceholderText('Nightly Capture'), {
      target: { value: 'My Schedule' },
    });
    fireEvent.change(screen.getByPlaceholderText('0 3 * * *'), {
      target: { value: '0 */6 * * *' },
    });
    fireEvent.change(screen.getByPlaceholderText('sentinel.config.json'), {
      target: { value: 'my-config.json' },
    });

    // Find and submit the form's Create Schedule button (the submit button, not the toggle button)
    const submitButtons = screen.getAllByText('Create Schedule');
    // The submit button is the one inside the form
    fireEvent.submit(submitButtons[submitButtons.length - 1]);

    expect(mutateFn).toHaveBeenCalled();
  });

  it('calls delete mutation when delete confirmed', () => {
    const mutateFn = vi.fn();
    mockUseQuery.mockReturnValue({
      data: sampleSchedules,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    mockUseMutation.mockReturnValue(mockMutationReturn(mutateFn));

    renderPage();
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('Confirm'));
    expect(mutateFn).toHaveBeenCalled();
  });

  it('shows cron presets in the create form', () => {
    setupMocks();
    renderPage();
    fireEvent.click(screen.getByText('Create Schedule'));
    expect(screen.getByText('Every 6 hours')).toBeInTheDocument();
    expect(screen.getByText('Daily at 3 AM')).toBeInTheDocument();
    expect(screen.getByText('Weekly Monday 9 AM')).toBeInTheDocument();
    expect(screen.getByText('Every 12 hours')).toBeInTheDocument();
  });

  it('shows empty state when no schedules', () => {
    setupMocks([]);
    renderPage();
    expect(screen.getByText('No schedules configured')).toBeInTheDocument();
  });

  it('shows loading state while query is pending', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useQuery>);

    mockUseMutation.mockReturnValue(mockMutationReturn());

    renderPage();
    expect(screen.getByText('Loading schedules...')).toBeInTheDocument();
  });

  it('shows history button for each schedule', () => {
    setupMocks(sampleSchedules);
    renderPage();
    const historyButtons = screen.getAllByText('History');
    expect(historyButtons.length).toBe(2);
  });
});
