import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuiteFilter } from './SuiteFilter';

const makeRuns = (names: (string | null)[]) =>
  names.map((suiteName) => ({ suiteName }));

describe('SuiteFilter', () => {
  it('renders nothing when no runs have suiteName', () => {
    const runs = makeRuns([null, null, null]);
    const { container } = render(
      <SuiteFilter runs={runs} selected={null} onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "All" plus unique suite names as buttons', () => {
    const runs = makeRuns(['smoke', 'regression', 'smoke', 'deploy']);
    render(<SuiteFilter runs={runs} selected={null} onChange={() => {}} />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('deploy')).toBeInTheDocument();
    expect(screen.getByText('regression')).toBeInTheDocument();
    expect(screen.getByText('smoke')).toBeInTheDocument();
  });

  it('calls onChange with suite name when clicking a suite button', () => {
    const onChange = vi.fn();
    const runs = makeRuns(['smoke', 'regression']);
    render(<SuiteFilter runs={runs} selected={null} onChange={onChange} />);

    fireEvent.click(screen.getByText('regression'));
    expect(onChange).toHaveBeenCalledWith('regression');
  });

  it('calls onChange with null when clicking "All"', () => {
    const onChange = vi.fn();
    const runs = makeRuns(['smoke', 'regression']);
    render(<SuiteFilter runs={runs} selected="smoke" onChange={onChange} />);

    fireEvent.click(screen.getByText('All'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('highlights the selected suite button with active styling', () => {
    const runs = makeRuns(['smoke', 'regression']);
    render(<SuiteFilter runs={runs} selected="smoke" onChange={() => {}} />);

    const smokeBtn = screen.getByText('smoke');
    const allBtn = screen.getByText('All');
    expect(smokeBtn.className).toContain('s-pill-active');
    expect(allBtn.className).not.toContain('s-pill-active');
  });
});
