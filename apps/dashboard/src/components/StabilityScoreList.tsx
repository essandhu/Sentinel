interface StabilityScoreEntry {
  url: string;
  viewport: string;
  browser: string;
  parameterName: string;
  stabilityScore: number;
  flipCount: number;
  totalRuns: number;
}

interface StabilityScoreListProps {
  scores: StabilityScoreEntry[];
  onSelectRoute?: (route: StabilityScoreEntry) => void;
}

function getScoreBadgeStyle(score: number): { bg: string; color: string } {
  if (score >= 80) return { bg: 'var(--s-success-dim)', color: 'var(--s-success)' };
  if (score >= 50) return { bg: 'var(--s-warning-dim)', color: 'var(--s-warning)' };
  return { bg: 'var(--s-danger-dim)', color: 'var(--s-danger)' };
}

function formatRouteLabel(entry: StabilityScoreEntry): string {
  const parts = [entry.url, entry.viewport];
  if (entry.parameterName) {
    parts.push(entry.parameterName);
  }
  return parts.join(' / ');
}

export function StabilityScoreList({ scores, onSelectRoute }: StabilityScoreListProps) {
  if (scores.length === 0) {
    return (
      <div className="s-glass rounded-lg py-8 text-center">
        <span className="mr-2" style={{ color: 'var(--s-success)' }}>&#10003;</span>
        <span className="text-sm" style={{ color: 'var(--s-text-secondary)' }}>No unstable routes detected</span>
      </div>
    );
  }

  // Sort by stability score ascending (worst first)
  const sorted = [...scores].sort((a, b) => a.stabilityScore - b.stabilityScore);

  return (
    <div className="s-glass overflow-x-auto rounded-lg">
      <table className="min-w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr style={{ background: 'var(--s-bg-raised)' }}>
            <th className="s-section-label px-4 py-2 text-left">Route</th>
            <th className="s-section-label px-4 py-2 text-left">Stability</th>
            <th className="s-section-label px-4 py-2 text-left">Flips</th>
            <th className="s-section-label px-4 py-2 text-left">Total Runs</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => {
            const badgeStyle = getScoreBadgeStyle(entry.stabilityScore);
            return (
              <tr
                key={`${entry.url}-${entry.viewport}-${entry.browser}-${entry.parameterName}`}
                className="cursor-pointer transition-colors"
                style={{ borderTop: '1px solid var(--s-border)' }}
                onClick={() => onSelectRoute?.(entry)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--s-bg-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
              >
                <td className="px-4 py-2 text-sm" style={{ color: 'var(--s-text-primary)' }}>{formatRouteLabel(entry)}</td>
                <td className="px-4 py-2">
                  <span
                    className="inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ background: badgeStyle.bg, color: badgeStyle.color }}
                  >
                    {entry.stabilityScore}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm" style={{ color: 'var(--s-text-secondary)' }}>{entry.flipCount}</td>
                <td className="px-4 py-2 text-sm" style={{ color: 'var(--s-text-secondary)' }}>{entry.totalRuns}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
