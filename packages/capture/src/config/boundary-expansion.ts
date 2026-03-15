import type { BreakpointTemplate } from './breakpoint-templates.js';

export interface BoundaryViewport {
  viewport: string;
  breakpointName: string;
  isBoundary: boolean;
  parentBreakpoint: string;
}

export interface BoundaryExpansionResult {
  viewports: BoundaryViewport[];
  totalViewportCount: number;
}

export type BoundaryMode = 'below' | 'above' | 'both';

/**
 * Expand breakpoint presets into boundary viewport variants.
 *
 * For each breakpoint, generates -1px (below), base, and/or +1px (above) viewports
 * depending on the mode. Deduplicates by viewport string (keeps first occurrence).
 *
 * @param presets - Array of breakpoint templates with name, width, height
 * @param mode - 'below' (default): -1px + base, 'above': base + +1px, 'both': -1px + base + +1px
 * @returns Expanded viewport list with boundary metadata
 */
export function expandBoundaryViewports(
  presets: BreakpointTemplate[],
  mode: BoundaryMode = 'below',
): BoundaryExpansionResult {
  if (presets.length === 0) {
    return { viewports: [], totalViewportCount: 0 };
  }

  const candidates: BoundaryViewport[] = [];

  for (const preset of presets) {
    // Generate -1px variant (below or both modes)
    if ((mode === 'below' || mode === 'both') && preset.width > 1) {
      candidates.push({
        viewport: `${preset.width - 1}x${preset.height}`,
        breakpointName: `${preset.name}-1px`,
        isBoundary: true,
        parentBreakpoint: preset.name,
      });
    }

    // Always generate the base viewport
    candidates.push({
      viewport: `${preset.width}x${preset.height}`,
      breakpointName: preset.name,
      isBoundary: false,
      parentBreakpoint: preset.name,
    });

    // Generate +1px variant (above or both modes)
    if (mode === 'above' || mode === 'both') {
      candidates.push({
        viewport: `${preset.width + 1}x${preset.height}`,
        breakpointName: `${preset.name}+1px`,
        isBoundary: true,
        parentBreakpoint: preset.name,
      });
    }
  }

  // Deduplicate by viewport string, keeping first occurrence
  const seen = new Set<string>();
  const viewports: BoundaryViewport[] = [];
  for (const candidate of candidates) {
    if (!seen.has(candidate.viewport)) {
      seen.add(candidate.viewport);
      viewports.push(candidate);
    }
  }

  return {
    viewports,
    totalViewportCount: viewports.length,
  };
}
