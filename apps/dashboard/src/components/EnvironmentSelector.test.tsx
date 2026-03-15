import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../trpc', () => ({
  trpc: {
    environments: {
      list: {
        queryOptions: vi.fn(() => ({
          queryKey: ['environments', 'list'],
          queryFn: async () => [],
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
import { EnvironmentSelector } from './EnvironmentSelector';

const mockUseQuery = vi.mocked(useQuery);

const sampleEnvironments = [
  { id: 'env-1', name: 'staging', baseUrl: 'https://staging.example.com', isReference: 0 },
  { id: 'env-2', name: 'production', baseUrl: 'https://example.com', isReference: 1 },
  { id: 'env-3', name: 'development', baseUrl: 'https://dev.example.com', isReference: 0 },
];

function setupMocks(environments = sampleEnvironments) {
  mockUseQuery.mockReturnValue({
    data: environments,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useQuery>);
}

describe('EnvironmentSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders two dropdowns and compare button', () => {
    setupMocks();
    render(<EnvironmentSelector projectId="proj-1" onSelect={vi.fn()} />);
    expect(screen.getByLabelText(/source environment/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target environment/i)).toBeInTheDocument();
    expect(screen.getByText('Compare')).toBeInTheDocument();
  });

  it('compare button is disabled when no selection made', () => {
    setupMocks();
    render(<EnvironmentSelector projectId="proj-1" onSelect={vi.fn()} />);
    const button = screen.getByText('Compare');
    expect(button).toBeDisabled();
  });

  it('compare button is disabled when same environment selected both sides', () => {
    setupMocks();
    render(<EnvironmentSelector projectId="proj-1" onSelect={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/source environment/i), {
      target: { value: 'staging' },
    });
    fireEvent.change(screen.getByLabelText(/target environment/i), {
      target: { value: 'staging' },
    });

    expect(screen.getByText('Compare')).toBeDisabled();
    expect(screen.getByText(/select different environments/i)).toBeInTheDocument();
  });

  it('calls onSelect with sourceEnv and targetEnv when compare clicked', () => {
    setupMocks();
    const onSelect = vi.fn();
    render(<EnvironmentSelector projectId="proj-1" onSelect={onSelect} />);

    fireEvent.change(screen.getByLabelText(/source environment/i), {
      target: { value: 'staging' },
    });
    fireEvent.change(screen.getByLabelText(/target environment/i), {
      target: { value: 'production' },
    });
    fireEvent.click(screen.getByText('Compare'));

    expect(onSelect).toHaveBeenCalledWith('staging', 'production');
  });

  it('shows "(reference)" label for reference environments in dropdown options', () => {
    setupMocks();
    render(<EnvironmentSelector projectId="proj-1" onSelect={vi.fn()} />);
    // The source dropdown should have an option with "(reference)" text
    const sourceSelect = screen.getByLabelText(/source environment/i);
    const options = sourceSelect.querySelectorAll('option');
    const refOption = Array.from(options).find((opt) => opt.textContent?.includes('(reference)'));
    expect(refOption).toBeTruthy();
    expect(refOption?.textContent).toContain('production');
  });

  it('returns null when no environments available', () => {
    setupMocks([]);
    const { container } = render(
      <EnvironmentSelector projectId="proj-1" onSelect={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
