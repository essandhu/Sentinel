interface ViolationCardProps {
  ruleId: string;
  impact: string;
  cssSelector: string;
  html: string | null;
  helpUrl: string | null;
  isNew: boolean;
}

const impactColors: Record<string, { bg: string; color: string }> = {
  critical: { bg: 'var(--s-danger-dim)', color: 'var(--s-danger)' },
  serious: { bg: 'rgba(232, 179, 57, 0.12)', color: '#e8a020' },
  moderate: { bg: 'var(--s-warning-dim)', color: 'var(--s-warning)' },
  minor: { bg: 'var(--s-info-dim)', color: 'var(--s-info)' },
};

export function ViolationCard({ ruleId, impact, cssSelector, html, helpUrl, isNew }: ViolationCardProps) {
  const colors = impactColors[impact] ?? { bg: 'var(--s-bg-raised)', color: 'var(--s-text-secondary)' };
  const truncatedHtml = html && html.length > 500 ? html.slice(0, 500) + '...' : html;

  return (
    <div className="s-glass rounded-lg p-4">
      {/* Top row: rule ID, impact badge, NEW badge */}
      <div className="mb-2 flex items-center gap-2">
        <span className="font-bold" style={{ color: 'var(--s-text-primary)' }}>{ruleId}</span>
        <span
          className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ background: colors.bg, color: colors.color }}
        >
          {impact}
        </span>
        {isNew && (
          <span
            className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ background: 'var(--s-danger)', color: 'var(--s-text-inverse)' }}
          >
            NEW
          </span>
        )}
      </div>

      {/* CSS selector */}
      <div
        className="mb-2 truncate text-sm"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--s-text-secondary)' }}
        title={cssSelector}
      >
        {cssSelector}
      </div>

      {/* HTML snippet */}
      {truncatedHtml && (
        <pre
          className="mb-2 max-h-20 overflow-y-auto rounded p-2 text-xs"
          style={{ background: 'var(--s-bg-raised)', color: 'var(--s-text-secondary)' }}
        >
          {truncatedHtml}
        </pre>
      )}

      {/* Help link */}
      {helpUrl && (
        <a
          href={helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm hover:underline"
          style={{ color: 'var(--s-accent-light)' }}
        >
          Learn more
        </a>
      )}
    </div>
  );
}
