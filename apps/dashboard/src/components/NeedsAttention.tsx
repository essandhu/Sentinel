interface NeedsAttentionItem {
  id: string;
  name: string;
  score: number;
  type: 'component' | 'url';
}

interface NeedsAttentionProps {
  items: NeedsAttentionItem[];
}

function getScoreStyle(score: number): { bg: string; color: string } {
  if (score >= 80) return { bg: 'var(--s-success-dim)', color: 'var(--s-success)' };
  if (score >= 50) return { bg: 'var(--s-warning-dim)', color: 'var(--s-warning)' };
  return { bg: 'var(--s-danger-dim)', color: 'var(--s-danger)' };
}

export function NeedsAttention({ items }: NeedsAttentionProps) {
  if (items.length === 0) return null;

  const top5 = items.slice(0, 5);

  return (
    <div className="space-y-2">
      {top5.map((item) => {
        const scoreStyle = getScoreStyle(item.score);
        return (
          <div key={item.id} className="s-glass flex items-center gap-3 rounded-lg p-3">
            <span
              className="inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: scoreStyle.bg, color: scoreStyle.color }}
            >
              {item.score}
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--s-text-primary)' }}>{item.name}</span>
            <span
              className="rounded px-1.5 py-0.5 text-xs"
              style={{ background: 'var(--s-bg-raised)', color: 'var(--s-text-secondary)' }}
            >
              {item.type}
            </span>
          </div>
        );
      })}
    </div>
  );
}
