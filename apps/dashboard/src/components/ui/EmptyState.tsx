import { Link } from 'react-router-dom';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; to: string } | { label: string; onClick: () => void };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl p-12 text-center"
      style={{
        border: '1px dashed var(--s-border-strong)',
        background: 'var(--s-bg-surface)',
      }}
    >
      {/* Empty state icon */}
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--s-text-tertiary)"
        strokeWidth="1"
        className="mb-4 opacity-50"
      >
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <h3
        className="text-sm font-semibold"
        style={{ color: 'var(--s-text-secondary)', fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px]" style={{ color: 'var(--s-text-tertiary)' }}>
          {description}
        </p>
      )}
      {action && (
        <div className="mt-5">
          {'to' in action ? (
            <Link to={action.to} className="s-btn s-btn-primary">
              {action.label}
            </Link>
          ) : (
            <button type="button" onClick={action.onClick} className="s-btn s-btn-primary">
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
