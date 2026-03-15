import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParameterFilter } from './ParameterFilter';

const makeDiffs = (names: (string | null)[]) =>
  names.map((parameterName) => ({ parameterName }));

describe('ParameterFilter', () => {
  it('renders nothing when no diffs have parameterName (all null)', () => {
    const { container } = render(
      <ParameterFilter diffs={makeDiffs([null, null])} selected={null} onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when all parameterName values are empty string', () => {
    const { container } = render(
      <ParameterFilter diffs={makeDiffs(['', ''])} selected={null} onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "All" button plus one button per unique parameterName', () => {
    const diffs = makeDiffs(['dark|en', 'light|en', 'dark|en']);
    render(<ParameterFilter diffs={diffs} selected={null} onChange={() => {}} />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('dark|en')).toBeInTheDocument();
    expect(screen.getByText('light|en')).toBeInTheDocument();
    // No duplicate for 'dark|en'
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('sorts parameterName values alphabetically', () => {
    const diffs = makeDiffs(['light|fr', 'dark|en', 'light|en']);
    render(<ParameterFilter diffs={diffs} selected={null} onChange={() => {}} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('All');
    expect(buttons[1]).toHaveTextContent('dark|en');
    expect(buttons[2]).toHaveTextContent('light|en');
    expect(buttons[3]).toHaveTextContent('light|fr');
  });

  it('calls onChange with parameterName when clicking a parameter button', () => {
    const onChange = vi.fn();
    const diffs = makeDiffs(['dark|en', 'light|en']);
    render(<ParameterFilter diffs={diffs} selected={null} onChange={onChange} />);

    fireEvent.click(screen.getByText('light|en'));
    expect(onChange).toHaveBeenCalledWith('light|en');
  });

  it('calls onChange with null when clicking "All"', () => {
    const onChange = vi.fn();
    const diffs = makeDiffs(['dark|en', 'light|en']);
    render(<ParameterFilter diffs={diffs} selected="dark|en" onChange={onChange} />);

    fireEvent.click(screen.getByText('All'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('applies active styling (s-pill-active) to selected parameter button', () => {
    const diffs = makeDiffs(['dark|en', 'light|en']);
    render(<ParameterFilter diffs={diffs} selected="dark|en" onChange={() => {}} />);

    const darkBtn = screen.getByText('dark|en');
    const allBtn = screen.getByText('All');
    const lightBtn = screen.getByText('light|en');

    expect(darkBtn.className).toContain('s-pill-active');
    expect(allBtn.className).not.toContain('s-pill-active');
    expect(lightBtn.className).not.toContain('s-pill-active');
  });
});
