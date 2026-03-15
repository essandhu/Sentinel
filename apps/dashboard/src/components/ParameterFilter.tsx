interface ParameterFilterProps {
  diffs: Array<{ parameterName: string | null }>;
  selected: string | null;
  onChange: (parameterName: string | null) => void;
}

/**
 * Filter bar for parameter names extracted from diff results.
 * Renders a button group: "All" + one button per unique parameterName.
 * Returns null (renders nothing) when no diffs have a parameterName.
 */
export function ParameterFilter({ diffs, selected, onChange }: ParameterFilterProps) {
  const uniqueNames = [
    ...new Set(
      diffs
        .map((d) => d.parameterName)
        .filter((n): n is string => n !== null && n !== ''),
    ),
  ].sort();

  if (uniqueNames.length === 0) return null;

  return (
    <div className="mb-4 flex gap-2" data-testid="parameter-filter">
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
    </div>
  );
}
