import { formatDistanceToNow } from './time-utils';

export interface StatusStripData {
  healthScore: number;
  healthTrend: number;
  pendingDiffs: number;
  lastRunTime: string | null;
  lastRunPassed: boolean;
  newRegressions: number;
  regressionTrend: number;
}

interface StatusStripProps {
  data: StatusStripData;
}

const trendDisplay = (value: number): { text: string; color: string } => {
  if (value > 0) return { text: `+${value}`, color: 'var(--color-success)' };
  if (value < 0) return { text: `${value}`, color: 'var(--color-danger)' };
  return { text: '0', color: 'var(--color-tertiary)' };
};

const healthColor = (score: number): string => {
  if (score >= 80) return 'var(--color-success)';
  if (score >= 50) return 'var(--color-warning)';
  return 'var(--color-danger)';
};

export const StatusStrip = ({ data }: StatusStripProps) => {
  const healthTrend = trendDisplay(data.healthTrend);
  const regTrend = trendDisplay(data.regressionTrend);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 s-stagger">
      {/* Health */}
      <div className="s-card-elevated p-4 flex flex-col gap-1">
        <span className="s-section-label">Health</span>
        <span className="s-metric-number" style={{ color: healthColor(data.healthScore) }}>
          {data.healthScore}
        </span>
        <span data-testid="health-trend" style={{ color: healthTrend.color }}>
          {healthTrend.text}
        </span>
      </div>

      {/* Pending */}
      <div className="s-card-elevated p-4 flex flex-col gap-1">
        <span className="s-section-label">Pending</span>
        <span
          className="s-metric-number"
          style={{ color: data.pendingDiffs > 0 ? 'var(--color-warning)' : undefined }}
        >
          {data.pendingDiffs}
        </span>
      </div>

      {/* Last Run */}
      <div className="s-card-elevated p-4 flex flex-col gap-1">
        <span className="s-section-label">Last Run</span>
        <span
          className="s-metric-number"
          style={{ color: data.lastRunPassed ? 'var(--color-success)' : 'var(--color-danger)' }}
        >
          {data.lastRunTime ? formatDistanceToNow(data.lastRunTime) : 'Never'}
        </span>
      </div>

      {/* Regressions */}
      <div className="s-card-elevated p-4 flex flex-col gap-1">
        <span className="s-section-label">Regressions</span>
        <span
          className="s-metric-number"
          style={{ color: data.newRegressions > 0 ? 'var(--color-danger)' : undefined }}
        >
          {data.newRegressions}
        </span>
        <span data-testid="regression-trend" style={{ color: regTrend.color }}>
          {regTrend.text}
        </span>
      </div>
    </div>
  );
};
