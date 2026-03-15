import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClassificationOverride } from './ClassificationOverride';

// Mock trpc
const mockMutate = vi.fn();
vi.mock('../trpc', () => ({
  trpcClient: {
    classifications: {
      override: { mutate: vi.fn() },
    },
  },
  queryClient: { invalidateQueries: vi.fn() },
}));

// Mock useMutation to track calls
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: vi.fn((opts: { mutationFn: (cat: string) => Promise<string> }) => ({
      mutate: (val: string) => {
        mockMutate(val);
        opts.mutationFn(val);
      },
      isPending: false,
    })),
  };
});

describe('ClassificationOverride', () => {
  beforeEach(() => {
    mockMutate.mockClear();
  });

  it('renders dropdown with current category selected', () => {
    render(
      <ClassificationOverride diffReportId="diff-1" currentCategory="layout" />,
    );
    const select = screen.getByTestId('override-select') as HTMLSelectElement;
    expect(select.value).toBe('layout');
  });

  it('renders all four category options', () => {
    render(
      <ClassificationOverride diffReportId="diff-1" currentCategory="style" />,
    );
    const select = screen.getByTestId('override-select') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(['layout', 'style', 'content', 'cosmetic']);
  });

  it('calls mutation with new category on change', async () => {
    render(
      <ClassificationOverride diffReportId="diff-1" currentCategory="layout" />,
    );
    const select = screen.getByTestId('override-select');
    await userEvent.selectOptions(select, 'style');
    expect(mockMutate).toHaveBeenCalledWith('style');
  });

  it('does not call mutation when selecting same category', async () => {
    render(
      <ClassificationOverride diffReportId="diff-1" currentCategory="layout" />,
    );
    const select = screen.getByTestId('override-select');
    await userEvent.selectOptions(select, 'layout');
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
