interface SuiteFilterProps {
  runs: Array<{ suiteName: string | null }>;
  selected: string | null;
  onChange: (suiteName: string | null) => void;
}

/**
 * Filter bar for suite names extracted from capture runs.
 * Renders a button group: "All" + one button per unique suite name.
 * Returns null (renders nothing) when no runs have a suiteName.
 */
export function SuiteFilter({ runs, selected, onChange }: SuiteFilterProps) {
  const uniqueNames = [
    ...new Set(runs.map((r) => r.suiteName).filter((n): n is string => n !== null)),
  ].sort();

  if (uniqueNames.length === 0) return null;

  return (
    <div className="mb-4 flex gap-1.5" data-testid="suite-filter">
      <button
        onClick={() => onChange(null)}
        className={selected === null ? 's-pill s-pill-active' : 's-pill s-pill-inactive'}
      >
        All
      </button>
      {uniqueNames.map((name) => (
        <button
          key={name}
          onClick={() => onChange(name)}
          className={selected === name ? 's-pill s-pill-active' : 's-pill s-pill-inactive'}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
