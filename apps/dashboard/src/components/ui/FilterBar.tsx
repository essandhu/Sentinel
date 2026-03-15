export interface FilterBarProps {
  filters: Array<{
    key: string;
    label: string;
    options: Array<{ value: string | null; label: string }>;
    selected: string | null;
    onChange: (value: string | null) => void;
  }>;
}

export function FilterBar({ filters }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-5">
      {filters.map((filter) => (
        <div key={filter.key} className="flex items-center gap-2">
          <span
            className="text-[12px] font-medium"
            style={{ color: 'var(--s-text-tertiary)' }}
          >
            {filter.label}
          </span>
          <div className="inline-flex gap-1">
            {filter.options.map((option) => {
              const isSelected = filter.selected === option.value;
              return (
                <button
                  key={option.value ?? '__null__'}
                  type="button"
                  onClick={() => filter.onChange(option.value)}
                  className={isSelected ? 's-pill s-pill-active' : 's-pill s-pill-inactive'}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
