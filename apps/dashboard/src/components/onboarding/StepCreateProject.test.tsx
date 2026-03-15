import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.hoisted for mock refs
const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}));

// Mock tRPC
vi.mock('../../trpc', () => ({
  trpc: {
    projects: {
      create: {
        mutationOptions: vi.fn((opts: any) => ({
          mutationKey: ['projects', 'create'],
          mutationFn: vi.fn(),
          ...opts,
        })),
      },
    },
  },
}));

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: vi.fn(),
  };
});

import { useMutation } from '@tanstack/react-query';
const mockUseMutation = vi.mocked(useMutation);

import { StepCreateProject } from './StepCreateProject';

const baseMutationReturn = {
  mutate: mockMutate,
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
  status: 'idle' as const,
  submittedAt: 0,
};

describe('StepCreateProject', () => {
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue(
      baseMutationReturn as unknown as ReturnType<typeof useMutation>,
    );
  });

  it('renders project name and repository URL fields', () => {
    render(<StepCreateProject onNext={mockOnNext} />);

    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/repository url/i)).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(<StepCreateProject onNext={mockOnNext} />);

    expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument();
  });

  it('shows validation error when submitting with empty name', async () => {
    const user = userEvent.setup();
    render(<StepCreateProject onNext={mockOnNext} />);

    await user.click(screen.getByRole('button', { name: /create project/i }));

    expect(screen.getByText('Project name is required')).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('calls mutate with trimmed project name on valid submit', async () => {
    const user = userEvent.setup();
    render(<StepCreateProject onNext={mockOnNext} />);

    await user.type(screen.getByLabelText(/project name/i), '  My Project  ');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      name: 'My Project',
    });
  });

  it('includes repository URL when provided', async () => {
    const user = userEvent.setup();
    render(<StepCreateProject onNext={mockOnNext} />);

    await user.type(screen.getByLabelText(/project name/i), 'My Project');
    await user.type(screen.getByLabelText(/repository url/i), '  https://github.com/org/repo  ');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      name: 'My Project',
      repositoryUrl: 'https://github.com/org/repo',
    });
  });

  it('omits repository URL when blank', async () => {
    const user = userEvent.setup();
    render(<StepCreateProject onNext={mockOnNext} />);

    await user.type(screen.getByLabelText(/project name/i), 'My Project');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      name: 'My Project',
    });
    expect(mockMutate.mock.calls[0][0]).not.toHaveProperty('repositoryUrl');
  });

  it('shows "Creating..." and disables button while pending', () => {
    mockUseMutation.mockReturnValue({
      ...baseMutationReturn,
      isPending: true,
      status: 'pending' as any,
    } as unknown as ReturnType<typeof useMutation>);

    render(<StepCreateProject onNext={mockOnNext} />);

    const button = screen.getByRole('button', { name: /creating/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Creating...');
  });
});
