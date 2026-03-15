import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  parseBoundaryName,
  getUniqueBaseBreakpoints,
  groupDiffsByBoundary,
  BoundaryGroup,
} from './BoundaryGroup';

describe('parseBoundaryName', () => {
  it('parses a -1px boundary name', () => {
    expect(parseBoundaryName('sm-1px')).toEqual({
      base: 'sm',
      suffix: '-1px',
      isBoundary: true,
    });
  });

  it('parses a +1px boundary name', () => {
    expect(parseBoundaryName('sm+1px')).toEqual({
      base: 'sm',
      suffix: '+1px',
      isBoundary: true,
    });
  });

  it('parses a base breakpoint name (no suffix)', () => {
    expect(parseBoundaryName('sm')).toEqual({
      base: 'sm',
      suffix: '',
      isBoundary: false,
    });
  });

  it('handles multi-character base names like 2xl', () => {
    expect(parseBoundaryName('2xl-1px')).toEqual({
      base: '2xl',
      suffix: '-1px',
      isBoundary: true,
    });
  });

  it('returns null for null input', () => {
    expect(parseBoundaryName(null)).toBeNull();
  });

  it('handles a plain name with no boundary suffix', () => {
    expect(parseBoundaryName('Desktop')).toEqual({
      base: 'Desktop',
      suffix: '',
      isBoundary: false,
    });
  });
});

describe('getUniqueBaseBreakpoints', () => {
  it('extracts unique base names from mixed boundary and non-boundary names', () => {
    const names = ['sm-1px', 'sm', 'sm+1px', 'md-1px', 'md', 'lg'];
    expect(getUniqueBaseBreakpoints(names)).toEqual(['lg', 'md', 'sm']);
  });

  it('filters out null values', () => {
    const names: (string | null)[] = ['sm-1px', null, 'sm', null];
    expect(getUniqueBaseBreakpoints(names)).toEqual(['sm']);
  });

  it('returns empty array for all nulls', () => {
    expect(getUniqueBaseBreakpoints([null, null])).toEqual([]);
  });
});

describe('groupDiffsByBoundary', () => {
  it('groups boundary variants under the base breakpoint name', () => {
    const diffs = [
      { id: '1', breakpointName: 'sm-1px' },
      { id: '2', breakpointName: 'sm' },
      { id: '3', breakpointName: 'sm+1px' },
      { id: '4', breakpointName: 'md-1px' },
      { id: '5', breakpointName: 'md' },
    ];

    const grouped = groupDiffsByBoundary(diffs);
    expect(grouped.get('sm')).toHaveLength(3);
    expect(grouped.get('md')).toHaveLength(2);
  });

  it('puts null breakpointName diffs into __other__ group', () => {
    const diffs = [
      { id: '1', breakpointName: null },
      { id: '2', breakpointName: 'sm' },
    ];

    const grouped = groupDiffsByBoundary(diffs);
    expect(grouped.get('__other__')).toHaveLength(1);
    expect(grouped.get('sm')).toHaveLength(1);
  });
});

describe('BoundaryGroup', () => {
  const makeDiff = (id: string, breakpointName: string, viewport: string) => ({
    id,
    snapshotId: id,
    snapshotS3Key: '',
    url: 'https://example.com',
    viewport,
    baselineS3Key: '',
    diffS3Key: '',
    pixelDiffPercent: null,
    ssimScore: null,
    passed: 'passed',
    browser: 'chromium',
    breakpointName,
    parameterName: null,
  });

  it('renders diffs sorted: -1px first, base second, +1px last', () => {
    const diffs = [
      makeDiff('2', 'sm', '640x800'),
      makeDiff('3', 'sm+1px', '641x800'),
      makeDiff('1', 'sm-1px', '639x800'),
    ];

    render(
      <BoundaryGroup
        baseName="sm"
        diffs={diffs}
        onSelect={() => {}}
      />,
    );

    const tiles = screen.getAllByTestId('boundary-tile');
    expect(tiles).toHaveLength(3);
    expect(tiles[0]).toHaveTextContent('sm-1px');
    expect(tiles[1]).toHaveTextContent('sm');
    expect(tiles[2]).toHaveTextContent('sm+1px');
  });

  it('shows viewport dimensions for each variant', () => {
    const diffs = [makeDiff('1', 'sm-1px', '639x800')];

    render(
      <BoundaryGroup
        baseName="sm"
        diffs={diffs}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText('639x800')).toBeInTheDocument();
  });

  it('handles single-item groups (no boundary variants)', () => {
    const diffs = [makeDiff('1', 'lg', '1024x800')];

    render(
      <BoundaryGroup
        baseName="lg"
        diffs={diffs}
        onSelect={() => {}}
      />,
    );

    const tiles = screen.getAllByTestId('boundary-tile');
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toHaveTextContent('lg');
  });

  it('calls onSelect when a tile is clicked', () => {
    const onSelect = vi.fn();
    const diffs = [makeDiff('1', 'sm-1px', '639x800')];

    render(
      <BoundaryGroup
        baseName="sm"
        diffs={diffs}
        onSelect={onSelect}
      />,
    );

    screen.getByTestId('boundary-tile').click();
    expect(onSelect).toHaveBeenCalledWith('1');
  });

  it('highlights selected diff tile', () => {
    const diffs = [
      makeDiff('1', 'sm-1px', '639x800'),
      makeDiff('2', 'sm', '640x800'),
    ];

    render(
      <BoundaryGroup
        baseName="sm"
        diffs={diffs}
        selectedDiffId="1"
        onSelect={() => {}}
      />,
    );

    const tiles = screen.getAllByTestId('boundary-tile');
    const tile0Style = (tiles[0] as HTMLElement).style;
    const tile1Style = (tiles[1] as HTMLElement).style;
    // Selected tile uses accent border via inline style object
    expect(tile0Style.border).toContain('var(--s-accent)');
    expect(tile1Style.border).not.toContain('var(--s-accent)');
  });
});
