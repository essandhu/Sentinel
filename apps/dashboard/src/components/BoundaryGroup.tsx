const BOUNDARY_SUFFIX_RE = /^(.+?)([+-]\d+px)$/;

const SUFFIX_ORDER: Record<string, number> = {
  '-1px': 0,
  '': 1,
  '+1px': 2,
};

export interface ParsedBoundaryName {
  base: string;
  suffix: string;
  isBoundary: boolean;
}

/**
 * Parse a breakpoint name into its base name and boundary suffix.
 * e.g. "sm-1px" -> { base: "sm", suffix: "-1px", isBoundary: true }
 *      "sm"     -> { base: "sm", suffix: "", isBoundary: false }
 */
export function parseBoundaryName(name: string | null | undefined): ParsedBoundaryName | null {
  if (name == null) return null;

  const match = name.match(BOUNDARY_SUFFIX_RE);
  if (match) {
    return { base: match[1], suffix: match[2], isBoundary: true };
  }

  return { base: name, suffix: '', isBoundary: false };
}

/**
 * Extract unique base breakpoint names from a list of breakpointName values.
 * Filters out nulls, collapses boundary variants (sm-1px, sm, sm+1px) into "sm".
 * Returns sorted array.
 */
export function getUniqueBaseBreakpoints(names: (string | null)[]): string[] {
  const bases = new Set<string>();
  for (const name of names) {
    const parsed = parseBoundaryName(name);
    if (parsed) {
      bases.add(parsed.base);
    }
  }
  return [...bases].sort();
}

/**
 * Group diffs by their base breakpoint name.
 * Null breakpointName diffs go into the '__other__' group.
 */
export function groupDiffsByBoundary<T extends { breakpointName: string | null }>(
  diffs: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const diff of diffs) {
    const parsed = parseBoundaryName(diff.breakpointName);
    const key = parsed ? parsed.base : '__other__';

    const group = groups.get(key);
    if (group) {
      group.push(diff);
    } else {
      groups.set(key, [diff]);
    }
  }

  return groups;
}

interface DiffItem {
  id: string;
  snapshotId: string;
  snapshotS3Key: string;
  url: string;
  viewport: string;
  baselineS3Key: string;
  diffS3Key: string;
  pixelDiffPercent: number | null;
  ssimScore: number | null;
  passed: string;
  browser: string;
  breakpointName: string | null;
  parameterName: string | null;
}

interface BoundaryGroupProps {
  baseName: string;
  diffs: DiffItem[];
  selectedDiffId?: string;
  onSelect: (diffId: string) => void;
}

/**
 * Visual grouping of boundary capture trio (e.g. sm-1px, sm, sm+1px).
 * Renders a bordered card with the base breakpoint name as header.
 * Diffs are sorted: -1px first, base second, +1px last.
 */
export function BoundaryGroup({ baseName, diffs, selectedDiffId, onSelect }: BoundaryGroupProps) {
  const sorted = [...diffs].sort((a, b) => {
    const pa = parseBoundaryName(a.breakpointName);
    const pb = parseBoundaryName(b.breakpointName);
    const orderA = SUFFIX_ORDER[pa?.suffix ?? ''] ?? 1;
    const orderB = SUFFIX_ORDER[pb?.suffix ?? ''] ?? 1;
    return orderA - orderB;
  });

  return (
    <div className="s-glass rounded-lg p-3" data-testid="boundary-group">
      <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--s-text-primary)' }}>{baseName}</h3>
      <div className="space-y-1">
        {sorted.map((diff) => {
          const isSelected = selectedDiffId === diff.id;
          return (
            <div
              key={diff.id}
              data-testid="boundary-tile"
              onClick={() => onSelect(diff.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(diff.id);
                }
              }}
              role="button"
              tabIndex={0}
              className="cursor-pointer rounded p-2 text-sm transition-colors"
              style={
                isSelected
                  ? { border: '1px solid var(--s-accent)', background: 'var(--s-accent-dim)' }
                  : { border: '1px solid var(--s-border)', background: 'var(--s-bg-surface)' }
              }
            >
              <div className="flex items-center justify-between">
                <span className="font-medium" style={{ color: 'var(--s-text-primary)' }}>{diff.breakpointName}</span>
                <span className="text-xs" style={{ color: 'var(--s-text-secondary)' }}>{diff.viewport}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
