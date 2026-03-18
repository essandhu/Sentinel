import { PerformanceScoreChart } from './PerformanceScoreChart';
import { StabilityScoreList } from './StabilityScoreList';

interface HealthMetricGridProps {
  visualScore: number;
  a11yScore: number;
  a11yViolationCount: number;
  projectId: string;
  routeUrls: string[];
  stabilityScores: Array<{
    url: string;
    viewport: string;
    browser: string;
    parameterName: string;
    stabilityScore: number;
    flipCount: number;
    totalRuns: number;
  }>;
  onSelectRoute: (route: {
    url: string;
    viewport: string;
    browser: string;
    parameterName: string;
  }) => void;
}

export function HealthMetricGrid({
  visualScore,
  a11yScore,
  a11yViolationCount,
  projectId,
  routeUrls,
  stabilityScores,
  onSelectRoute,
}: HealthMetricGridProps) {
  return (
    <div data-testid="metric-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div data-testid="metric-card" className="s-card-elevated p-5">
        <h3
          className="text-[14px] font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
        >
          Visual Consistency
        </h3>
        <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--s-text-primary)' }}>
          {visualScore}
        </p>
        <p className="mt-1 text-[12px]" style={{ color: 'var(--s-text-tertiary)' }}>
          Based on visual diff analysis
        </p>
      </div>

      <div data-testid="metric-card" className="s-card-elevated p-5">
        <h3
          className="text-[14px] font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
        >
          Accessibility
        </h3>
        <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--s-text-primary)' }}>
          {a11yScore}
        </p>
        <p className="mt-1 text-[12px]" style={{ color: 'var(--s-text-tertiary)' }}>
          {a11yViolationCount} accessibility violations tracked
        </p>
      </div>

      <div data-testid="metric-card" className="s-card-elevated p-5">
        <h3
          className="text-[14px] font-semibold mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
        >
          Performance Scores
        </h3>
        {routeUrls.length > 0 ? (
          <PerformanceScoreChart projectId={projectId} routeUrls={routeUrls} />
        ) : (
          <p className="text-[12px]" style={{ color: 'var(--s-text-tertiary)' }}>
            No performance data yet
          </p>
        )}
      </div>

      <div data-testid="metric-card" className="s-card-elevated p-5">
        <h3
          className="text-[14px] font-semibold mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
        >
          Route Stability
        </h3>
        <StabilityScoreList scores={stabilityScores} onSelectRoute={onSelectRoute} />
      </div>
    </div>
  );
}
