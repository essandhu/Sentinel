import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock the trpc module
vi.mock('../trpc', () => ({
  useTRPC: vi.fn(),
  trpc: {
    projects: {
      list: {
        queryOptions: vi.fn(() => ({ queryKey: ['projects', 'list'], queryFn: async () => [] })),
      },
      create: {
        mutationOptions: vi.fn((opts: any) => ({
          mutationKey: ['projects', 'create'],
          mutationFn: vi.fn(),
          ...opts,
        })),
      },
    },
  },
  queryClient: { defaultOptions: {} },
  TRPCProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock @tanstack/react-query's useQuery
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(() => ({
      mutateAsync: vi.fn(),
      isPending: false,
    })),
  };
});

import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '../trpc';
import { OnboardingGuard } from '../components/onboarding/OnboardingGuard';
import { OnboardingPage } from './OnboardingPage';

const mockUseQuery = vi.mocked(useQuery);
const mockUseTRPC = vi.mocked(useTRPC);

function renderGuard(children: React.ReactNode = <div>Dashboard Content</div>) {
  return render(
    <MemoryRouter>
      <OnboardingGuard>{children}</OnboardingGuard>
    </MemoryRouter>,
  );
}

// Mock localStorage
const localStorageMock: Record<string, string> = {};
const originalGetItem = globalThis.localStorage?.getItem;
const originalSetItem = globalThis.localStorage?.setItem;

beforeEach(() => {
  Object.keys(localStorageMock).forEach((k) => delete localStorageMock[k]);
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { localStorageMock[key] = value; }),
      removeItem: vi.fn((key: string) => { delete localStorageMock[key]; }),
      clear: vi.fn(() => { Object.keys(localStorageMock).forEach((k) => delete localStorageMock[k]); }),
      length: 0,
      key: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
});

describe('OnboardingGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTRPC.mockReturnValue({} as ReturnType<typeof useTRPC>);
  });

  it('renders children when projects exist', () => {
    mockUseQuery.mockReturnValue({
      data: [{ id: 'proj-1', name: 'My Project', createdAt: new Date() }],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    renderGuard(<div>Dashboard Content</div>);
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('renders OnboardingPage when no projects exist', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    renderGuard();
    expect(screen.getByText(/welcome to sentinel/i)).toBeInTheDocument();
  });

  it('shows loading state while query is loading', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useQuery>);

    renderGuard();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('bypasses query and renders children when onboarding_complete is set in localStorage', () => {
    localStorageMock['onboarding_complete'] = 'true';
    // Even if query says loading, children should render because localStorage fast-path takes priority
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useQuery>);

    renderGuard(<div>Dashboard Content</div>);
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });
});

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTRPC.mockReturnValue({} as ReturnType<typeof useTRPC>);
  });

  it('renders step indicators and StepCreateProject by default', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>);

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/welcome to sentinel/i)).toBeInTheDocument();
    // Step 1 should show project creation form (heading)
    expect(screen.getByRole('heading', { name: /create project/i })).toBeInTheDocument();
    // Step indicators should be visible
    expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
  });
});
