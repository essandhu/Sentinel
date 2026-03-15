import { getUniqueBaseBreakpoints } from './BoundaryGroup';

export const BREAKPOINT_OTHER = '__other__';

interface BreakpointFilterProps {
  diffs: Array<{ breakpointName: string | null }>;
  selected: string | null;
  onChange: (breakpointName: string | null) => void;
}

/**
 * Filter bar for breakpoint names extracted from diff results.
 * Renders a button group: "All" + one button per unique breakpoint name.
 * Collapses boundary variants (sm-1px, sm, sm+1px) into a single "sm" button.
 * Returns null (renders nothing) when no diffs have a breakpointName.
 */
export function BreakpointFilter({ diffs, selected, onChange }: BreakpointFilterProps) {
  const hasNulls = diffs.some((d) => d.breakpointName === null);
  const uniqueNames = getUniqueBaseBreakpoints(
    diffs.map((d) => d.breakpointName),
  );

  // If no breakpoint names exist at all, hide the filter
  if (uniqueNames.length === 0 && !hasNulls) return null;
  // If all are null, also hide -- there's nothing meaningful to filter
  if (uniqueNames.length === 0) return null;

  return (
    <div className="mb-4 flex gap-2" data-testid="breakpoint-filter">
      <button
        onClick={() => onChange(null)}
        className={`s-pill ${selected === null ? 's-pill-active' : 's-pill-inactive'}`}
      >
        All
      </button>
      {uniqueNames.map((name) => (
        <button
          key={name}
          onClick={() => onChange(name)}
          className={`s-pill ${selected === name ? 's-pill-active' : 's-pill-inactive'}`}
        >
          {name}
        </button>
      ))}
      {hasNulls && (
        <button
          onClick={() => onChange(BREAKPOINT_OTHER)}
          className={`s-pill ${selected === BREAKPOINT_OTHER ? 's-pill-active' : 's-pill-inactive'}`}
        >
          Other
        </button>
      )}
    </div>
  );
}
