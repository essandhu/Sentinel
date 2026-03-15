import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BreakpointFilter } from './BreakpointFilter';

const makeDiffs = (names: (string | null)[]) =>
  names.map((breakpointName) => ({ breakpointName }));

describe('BreakpointFilter', () => {
  it('renders "All" option plus unique breakpoint names from diffs', () => {
    const diffs = makeDiffs(['Desktop', 'Tablet', 'Desktop', 'Mobile']);
    render(<BreakpointFilter diffs={diffs} selected={null} onChange={() => {}} />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Desktop')).toBeInTheDocument();
    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(screen.getByText('Tablet')).toBeInTheDocument();
  });

  it('sorts breakpoint names alphabetically', () => {
    const diffs = makeDiffs(['Tablet', 'Desktop', 'Mobile']);
    render(<BreakpointFilter diffs={diffs} selected={null} onChange={() => {}} />);

    const buttons = screen.getAllByRole('button');
    // "All" first, then alphabetical
    expect(buttons[0]).toHaveTextContent('All');
    expect(buttons[1]).toHaveTextContent('Desktop');
    expect(buttons[2]).toHaveTextContent('Mobile');
    expect(buttons[3]).toHaveTextContent('Tablet');
  });

  it('returns null (hides filter) when no diffs have breakpointName', () => {
    const diffs = makeDiffs([null, null, null]);
    const { container } = render(
      <BreakpointFilter diffs={diffs} selected={null} onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls onChange with breakpoint name when selecting a breakpoint', () => {
    const onChange = vi.fn();
    const diffs = makeDiffs(['Desktop', 'Mobile']);
    render(<BreakpointFilter diffs={diffs} selected={null} onChange={onChange} />);

    fireEvent.click(screen.getByText('Mobile'));
    expect(onChange).toHaveBeenCalledWith('Mobile');
  });

  it('calls onChange with null when selecting "All"', () => {
    const onChange = vi.fn();
    const diffs = makeDiffs(['Desktop', 'Mobile']);
    render(<BreakpointFilter diffs={diffs} selected="Desktop" onChange={onChange} />);

    fireEvent.click(screen.getByText('All'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('highlights the selected breakpoint button', () => {
    const diffs = makeDiffs(['Desktop', 'Mobile']);
    render(<BreakpointFilter diffs={diffs} selected="Desktop" onChange={() => {}} />);

    const desktopBtn = screen.getByText('Desktop');
    const allBtn = screen.getByText('All');
    expect(desktopBtn.className).toContain('s-pill-active');
    expect(allBtn.className).not.toContain('s-pill-active');
  });

  it('groups null breakpointName values as "Other" in filter options', () => {
    const diffs = makeDiffs(['Desktop', null, 'Mobile', null]);
    render(<BreakpointFilter diffs={diffs} selected={null} onChange={() => {}} />);

    // "Other" should appear for null values
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  it('calls onChange with null-string sentinel when selecting "Other"', () => {
    const onChange = vi.fn();
    const diffs = makeDiffs(['Desktop', null]);
    render(<BreakpointFilter diffs={diffs} selected={null} onChange={onChange} />);

    fireEvent.click(screen.getByText('Other'));
    expect(onChange).toHaveBeenCalledWith('__other__');
  });

  it('collapses boundary variants into parent breakpoint buttons', () => {
    const diffs = makeDiffs(['sm-1px', 'sm', 'sm+1px', 'md-1px', 'md']);
    render(<BreakpointFilter diffs={diffs} selected={null} onChange={() => {}} />);

    // Should show "sm" and "md" buttons, not individual variants
    const buttons = screen.getAllByRole('button');
    const labels = buttons.map((b) => b.textContent);
    expect(labels).toContain('sm');
    expect(labels).toContain('md');
    expect(labels).not.toContain('sm-1px');
    expect(labels).not.toContain('sm+1px');
    expect(labels).not.toContain('md-1px');
  });

  it('calls onChange with base name when clicking collapsed boundary button', () => {
    const onChange = vi.fn();
    const diffs = makeDiffs(['sm-1px', 'sm', 'sm+1px']);
    render(<BreakpointFilter diffs={diffs} selected={null} onChange={onChange} />);

    fireEvent.click(screen.getByText('sm'));
    expect(onChange).toHaveBeenCalledWith('sm');
  });
});
