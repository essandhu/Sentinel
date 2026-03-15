import { describe, it, expect } from 'vitest';
import { expandBoundaryViewports, type BoundaryViewport, type BoundaryExpansionResult } from './boundary-expansion.js';
import type { BreakpointTemplate } from './breakpoint-templates.js';

describe('expandBoundaryViewports', () => {
  it('generates -1px + base for a single breakpoint (default mode=below)', () => {
    const presets: BreakpointTemplate[] = [{ name: 'sm', width: 640, height: 480 }];
    const result = expandBoundaryViewports(presets);

    expect(result.viewports).toHaveLength(2);
    expect(result.viewports[0]).toEqual({
      viewport: '639x480',
      breakpointName: 'sm-1px',
      isBoundary: true,
      parentBreakpoint: 'sm',
    });
    expect(result.viewports[1]).toEqual({
      viewport: '640x480',
      breakpointName: 'sm',
      isBoundary: false,
      parentBreakpoint: 'sm',
    });
    expect(result.totalViewportCount).toBe(2);
  });

  it('generates correct count for multiple Tailwind breakpoints', () => {
    const presets: BreakpointTemplate[] = [
      { name: 'sm', width: 640, height: 480 },
      { name: 'md', width: 768, height: 1024 },
      { name: 'lg', width: 1024, height: 768 },
    ];
    const result = expandBoundaryViewports(presets);

    // 3 breakpoints * 2 (base + -1px) = 6
    expect(result.viewports).toHaveLength(6);
    expect(result.totalViewportCount).toBe(6);
  });

  it('generates -1px + base + +1px with mode=both', () => {
    const presets: BreakpointTemplate[] = [{ name: 'sm', width: 640, height: 480 }];
    const result = expandBoundaryViewports(presets, 'both');

    expect(result.viewports).toHaveLength(3);
    expect(result.viewports[0]).toEqual({
      viewport: '639x480',
      breakpointName: 'sm-1px',
      isBoundary: true,
      parentBreakpoint: 'sm',
    });
    expect(result.viewports[1]).toEqual({
      viewport: '640x480',
      breakpointName: 'sm',
      isBoundary: false,
      parentBreakpoint: 'sm',
    });
    expect(result.viewports[2]).toEqual({
      viewport: '641x480',
      breakpointName: 'sm+1px',
      isBoundary: true,
      parentBreakpoint: 'sm',
    });
  });

  it('generates base + +1px only with mode=above', () => {
    const presets: BreakpointTemplate[] = [{ name: 'sm', width: 640, height: 480 }];
    const result = expandBoundaryViewports(presets, 'above');

    expect(result.viewports).toHaveLength(2);
    expect(result.viewports[0]).toEqual({
      viewport: '640x480',
      breakpointName: 'sm',
      isBoundary: false,
      parentBreakpoint: 'sm',
    });
    expect(result.viewports[1]).toEqual({
      viewport: '641x480',
      breakpointName: 'sm+1px',
      isBoundary: true,
      parentBreakpoint: 'sm',
    });
  });

  it('deduplicates when adjacent breakpoints produce overlapping widths', () => {
    // sm=640, md=641 => sm+1px would be 641x480 which overlaps with md base (641x1024)
    // But heights differ so they should NOT overlap.
    // For real dedup: sm=640 h=480, md=641 h=480 => sm+1px = 641x480 same as md base
    const presets: BreakpointTemplate[] = [
      { name: 'sm', width: 640, height: 480 },
      { name: 'md', width: 641, height: 480 },
    ];
    const result = expandBoundaryViewports(presets, 'both');

    // sm: 639x480, 640x480, 641x480
    // md: 640x480 (dup!), 641x480 (dup!), 642x480
    // After dedup: 639x480, 640x480, 641x480, 642x480 = 4
    const viewportStrings = result.viewports.map(v => v.viewport);
    const uniqueViewports = new Set(viewportStrings);
    expect(viewportStrings.length).toBe(uniqueViewports.size); // no dups
    expect(result.viewports).toHaveLength(4);
  });

  it('skips -1px generation when width <= 1', () => {
    const presets: BreakpointTemplate[] = [{ name: 'tiny', width: 1, height: 100 }];
    const result = expandBoundaryViewports(presets);

    // Only base viewport, no -1px (would be 0)
    expect(result.viewports).toHaveLength(1);
    expect(result.viewports[0]).toEqual({
      viewport: '1x100',
      breakpointName: 'tiny',
      isBoundary: false,
      parentBreakpoint: 'tiny',
    });
  });

  it('returns empty viewports for empty presets', () => {
    const result = expandBoundaryViewports([]);

    expect(result.viewports).toHaveLength(0);
    expect(result.totalViewportCount).toBe(0);
  });
});
