import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../trpc', () => ({
  trpc: {
    environments: {
      compareDiff: {
        queryOptions: vi.fn(() => ({
          queryKey: ['environments', 'compareDiff'],
          queryFn: async () => null,
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

import { useQuery } from '@tanstack/react-query';
import { EnvironmentDiffView } from './EnvironmentDiffView';

const mockUseQuery = vi.mocked(useQuery);

const defaultProps = {
  projectId: 'proj-1',
  sourceEnv: 'staging',
  targetEnv: 'production',
  url: '/home',
  viewport: '1920x1080',
  browser: 'chromium',
};

describe('EnvironmentDiffView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useQuery>);

    render(<EnvironmentDiffView {...defaultProps} />);
    expect(screen.getByText('Computing environment diff...')).toBeInTheDocument();
  });

  it('renders pass status after data loaded', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'computed',
        diff: {
          pixelDiffPercent: 50, // 0.50%
          ssimScore: 9950, // 0.9950
          passed: true,
          diffS3Key: null,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useQuery>);

    render(<EnvironmentDiffView {...defaultProps} />);
    expect(screen.getByText('Passed')).toBeInTheDocument();
  });

  it('renders fail status after data loaded', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'computed',
        diff: {
          pixelDiffPercent: 1500, // 15.00%
          ssimScore: 8500, // 0.8500
          passed: false,
          diffS3Key: null,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useQuery>);

    render(<EnvironmentDiffView {...defaultProps} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('displays pixel diff percent and SSIM score', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'computed',
        diff: {
          pixelDiffPercent: 250, // 2.50%
          ssimScore: 9800, // 0.9800
          passed: false,
          diffS3Key: null,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useQuery>);

    render(<EnvironmentDiffView {...defaultProps} />);
    expect(screen.getByText('2.50%')).toBeInTheDocument();
    expect(screen.getByText('0.9800')).toBeInTheDocument();
  });

  it('handles missing_snapshot status', () => {
    mockUseQuery.mockReturnValue({
      data: {
        status: 'missing_snapshot',
        missingEnv: 'staging',
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useQuery>);

    render(<EnvironmentDiffView {...defaultProps} />);
    expect(screen.getByText(/no snapshot found/i)).toBeInTheDocument();
    expect(screen.getByText('staging')).toBeInTheDocument();
  });

  it('shows error message when query fails', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: 'Network error' },
    } as ReturnType<typeof useQuery>);

    render(<EnvironmentDiffView {...defaultProps} />);
    expect(screen.getByText(/failed to compute diff/i)).toBeInTheDocument();
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });
});
