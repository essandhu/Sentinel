const categoryColors: Record<string, { bg: string; color: string }> = {
  layout: { bg: 'rgba(147, 51, 234, 0.15)', color: '#c084fc' },
  style: { bg: 'var(--s-info-dim)', color: 'var(--s-info)' },
  content: { bg: 'var(--s-accent-dim)', color: 'var(--s-accent-light)' },
  cosmetic: { bg: 'var(--s-bg-raised)', color: 'var(--s-text-secondary)' },
};

interface ClassificationBadgeProps {
  category: string;
  confidence: number;
}

export function ClassificationBadge({ category, confidence }: ClassificationBadgeProps) {
  const colors = categoryColors[category] ?? { bg: 'var(--s-bg-raised)', color: 'var(--s-text-secondary)' };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: colors.bg, color: colors.color }}
      data-testid="classification-badge"
    >
      {category}
      <span className="font-normal opacity-70">{confidence}%</span>
    </span>
  );
}
