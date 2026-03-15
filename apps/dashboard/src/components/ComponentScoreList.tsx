import { Sparkline } from './Sparkline';

interface ComponentScoreItem {
  componentId: string;
  componentName: string;
  score: number;
  trend: Array<{ score: number }>;
}

interface ComponentScoreListProps {
  components: ComponentScoreItem[];
}

function getScoreStyle(score: number): { bg: string; color: string } {
  if (score >= 80) return { bg: 'var(--s-success-dim)', color: 'var(--s-success)' };
  if (score >= 50) return { bg: 'var(--s-warning-dim)', color: 'var(--s-warning)' };
  return { bg: 'var(--s-danger-dim)', color: 'var(--s-danger)' };
}

function getSparklineColor(score: number): string {
  if (score >= 80) return 'var(--s-success)';
  if (score >= 50) return 'var(--s-warning)';
  return 'var(--s-danger)';
}

export function ComponentScoreList({ components }: ComponentScoreListProps) {
  if (components.length === 0) {
    return (
      <div
        className="rounded-lg border-dashed py-8 text-center text-sm"
        style={{ border: '1px dashed var(--s-border-strong)', color: 'var(--s-text-secondary)' }}
      >
        No component data
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {components.map((comp) => {
        const scoreStyle = getScoreStyle(comp.score);
        return (
          <div key={comp.componentId} className="s-glass flex items-center gap-3 rounded-lg p-3">
            {/* Score badge */}
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: scoreStyle.bg, color: scoreStyle.color, border: `1px solid ${scoreStyle.color}33` }}
            >
              {comp.score}
            </span>

            {/* Component name */}
            <span className="flex-1 text-sm font-medium" style={{ color: 'var(--s-text-primary)' }}>
              {comp.componentName}
            </span>

            {/* Sparkline */}
            <Sparkline data={comp.trend} color={getSparklineColor(comp.score)} />
          </div>
        );
      })}
    </div>
  );
}
