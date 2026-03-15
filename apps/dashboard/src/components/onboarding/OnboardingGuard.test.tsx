import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingGuard } from './OnboardingGuard';

// Mock localStorage
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

// Mock trpc
vi.mock('../../trpc', () => ({
  trpc: {
    projects: {
      list: {
        queryOptions: () => ({ queryKey: ['projects', 'list'], queryFn: vi.fn() }),
      },
    },
  },
}));

// Mock LoadingState
vi.mock('../ui/LoadingState', () => ({
  LoadingState: ({ message }: { message: string }) => <div data-testid="loading">{message}</div>,
}));

// Mock OnboardingPage
vi.mock('../../pages/OnboardingPage', () => ({
  OnboardingPage: () => <div data-testid="onboarding-page">Onboarding</div>,
}));

// Mock @tanstack/react-query
const mockUseQuery = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });
  vi.clearAllMocks();
  // Default: useQuery returns loading false, no data
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
});

describe('OnboardingGuard', () => {
  it('renders children immediately when onboarding is already complete', () => {
    store['onboarding_complete'] = 'true';

    render(
      <OnboardingGuard>
        <div data-testid="child">Dashboard</div>
      </OnboardingGuard>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('skips query when onboarding is complete', () => {
    store['onboarding_complete'] = 'true';
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

    render(
      <OnboardingGuard>
        <div>Dashboard</div>
      </OnboardingGuard>,
    );

    // useQuery should be called with enabled: false
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it('shows loading state while fetching projects', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    render(
      <OnboardingGuard>
        <div>Dashboard</div>
      </OnboardingGuard>,
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows onboarding page when no projects exist', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });

    render(
      <OnboardingGuard>
        <div>Dashboard</div>
      </OnboardingGuard>,
    );

    expect(screen.getByTestId('onboarding-page')).toBeInTheDocument();
  });

  it('shows onboarding page when projects is undefined', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

    render(
      <OnboardingGuard>
        <div>Dashboard</div>
      </OnboardingGuard>,
    );

    expect(screen.getByTestId('onboarding-page')).toBeInTheDocument();
  });

  it('renders children when projects exist', () => {
    mockUseQuery.mockReturnValue({
      data: [{ id: 'proj-1', name: 'My Project' }],
      isLoading: false,
    });

    render(
      <OnboardingGuard>
        <div data-testid="child">Dashboard</div>
      </OnboardingGuard>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
