export interface DiffActionBarProps {
  onApprove: () => void;
  onReject: () => void;
  current?: number;
  total?: number;
  onPrev?: () => void;
  onNext?: () => void;
  canApprove?: boolean;
}

export function DiffActionBar({
  onApprove,
  onReject,
  current,
  total,
  onPrev,
  onNext,
  canApprove,
}: DiffActionBarProps) {
  return (
    <div
      className="sticky bottom-0 flex items-center justify-between px-5 py-3"
      style={{
        background: 'var(--s-bg-surface)',
        borderTop: '1px solid var(--s-border)',
      }}
      data-testid="diff-action-bar"
    >
      {/* Left: navigation */}
      <div className="flex items-center gap-2">
        {onPrev && (
          <button
            className="s-btn s-btn-ghost"
            onClick={onPrev}
            aria-label="Prev"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {onNext && (
          <button
            className="s-btn s-btn-ghost"
            onClick={onNext}
            aria-label="Next"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {(onPrev || onNext) && (
          <span style={{ fontSize: 11, color: 'var(--s-text-tertiary)' }}>j/k</span>
        )}
        {current != null && total != null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--s-text-secondary)' }}>
            {current} of {total}
          </span>
        )}
      </div>

      {/* Right: actions */}
      {canApprove && (
        <div className="flex items-center gap-2">
          <button className="s-btn s-btn-danger" onClick={onReject} aria-label="Reject">
            Reject
            <span style={{ fontSize: 11, color: 'var(--s-text-tertiary)', marginLeft: 4 }}>r</span>
          </button>
          <button className="s-btn s-btn-success" onClick={onApprove} aria-label="Approve">
            Approve
            <span style={{ fontSize: 11, color: 'var(--s-text-tertiary)', marginLeft: 4 }}>a</span>
          </button>
        </div>
      )}
    </div>
  );
}
