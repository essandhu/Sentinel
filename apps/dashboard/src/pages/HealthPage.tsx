import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { trpc } from '../trpc';
import { HealthGauge } from '../components/HealthGauge';
import { HealthTrendChart } from '../components/HealthTrendChart';
import { ComponentScoreList } from '../components/ComponentScoreList';
import { NeedsAttention } from '../components/NeedsAttention';
import { PerformanceScoreChart } from '../components/PerformanceScoreChart';
import { StabilityScoreList } from '../components/StabilityScoreList';
import { FlipHistoryChart } from '../components/FlipHistoryChart';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

function formatDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

export function HealthPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const safeProjectId = projectId ?? '';
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');
  const [selectedRoute, setSelectedRoute] = useState<{
    url: string;
    viewport: string;
    browser: string;
    parameterName: string;
  } | null>(null);

  // Main queries
  const { data: projectScore, isLoading: loadingScore } = useQuery(
    trpc.healthScores.projectScore.queryOptions({ projectId: safeProjectId }),
  );
  const { data: componentScores, isLoading: loadingComponents } = useQuery(
    trpc.healthScores.componentScores.queryOptions({ projectId: safeProjectId }),
  );
  const { data: trendData, isLoading: loadingTrend } = useQuery(
    trpc.healthScores.trend.queryOptions({ projectId: safeProjectId, windowDays: timeRange }),
  );
  const { data: a11yData } = useQuery(
    trpc.a11y.byProject.queryOptions({ projectId: safeProjectId }),
  );
  const { data: routeUrls } = useQuery(
    trpc.lighthouse.routeUrls.queryOptions({ projectId: safeProjectId }),
  );

  // Stability scores
  const { data: stabilityScores } = useQuery(
    trpc.stability.list.queryOptions({ projectId: safeProjectId }),
  );

  // Flip history for selected route
  const { data: flipHistory } = useQuery(
    trpc.stability.flipHistory.queryOptions({
      projectId: safeProjectId,
      url: selectedRoute?.url ?? '',
      viewport: selectedRoute?.viewport ?? '',
      browser: selectedRoute?.browser ?? '',
      parameterName: selectedRoute?.parameterName ?? '',
    }),
  );

  // Per-component sparkline data fetching
  const componentTrendQueries = useQueries({
    queries: (componentScores ?? []).map((comp) =>
      trpc.healthScores.trend.queryOptions({
        projectId: safeProjectId,
        windowDays: '30',
        componentId: comp.componentId ?? undefined,
      }),
    ),
  });

  const enrichedComponents = (componentScores ?? []).map((comp, i) => ({
    ...comp,
    componentId: comp.componentId ?? '',
    trend: (componentTrendQueries[i]?.data ?? []).map((d) => ({ score: d.score })),
  }));

  const formattedTrend = (trendData ?? []).map((d) => ({
    date: formatDate(d.computedAt),
    score: d.score,
  }));

  const attentionItems = enrichedComponents.slice(0, 5).map((comp) => ({
    id: comp.componentId,
    name: comp.componentName,
    score: comp.score,
    type: 'component' as const,
  }));

  const isLoading = loadingScore || loadingComponents || loadingTrend;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <LoadingState message="Loading health data..." />
      </div>
    );
  }

  if (!projectScore) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 s-animate-in">
        <PageHeader title="Project Health" />
        <div className="mt-6">
          <EmptyState
            title="No health data yet"
            description="Run a capture or create a schedule to start tracking health."
            action={{ label: 'Create Schedule', to: `/projects/${projectId}/schedules` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 s-animate-in">
      <PageHeader title="Project Health" />

      {/* Top section: Gauge + Trend Chart */}
      <div className="mb-8 mt-6 flex flex-col gap-8 md:flex-row md:items-start s-stagger">
        <div className="flex flex-col items-center">
          <HealthGauge
            score={projectScore.score}
            breakdown={a11yData && a11yData.latestRunId ? {
              visual: projectScore.score,
              accessibility: a11yData.totalViolations > 0
                ? Math.round(((a11yData.totalViolations - a11yData.newCount) / a11yData.totalViolations) * 100)
                : 100,
            } : undefined}
          />
          <p className="mt-2 text-[12px]" style={{ color: 'var(--s-text-tertiary)' }}>Overall Score</p>
        </div>
        <div className="flex-1 s-glass p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2
              className="text-sm font-semibold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
            >
              Score Trend
            </h2>
            <div className="flex gap-1.5">
              {(['7', '30', '90'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={timeRange === range ? 's-pill s-pill-active' : 's-pill s-pill-inactive'}
                >
                  {range}d
                </button>
              ))}
            </div>
          </div>
          <HealthTrendChart data={formattedTrend} />
        </div>
      </div>

      {/* Needs Attention section */}
      {attentionItems.length > 0 && (
        <section className="mb-8">
          <h2
            className="mb-3 text-sm font-semibold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
          >
            Needs Attention
          </h2>
          <NeedsAttention items={attentionItems} />
        </section>
      )}

      {/* Performance Scores section */}
      {routeUrls && routeUrls.length > 0 && (
        <section className="mb-8">
          <h2
            className="mb-3 text-sm font-semibold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
          >
            Performance Scores
          </h2>
          <div className="s-glass p-5">
            <PerformanceScoreChart
              projectId={safeProjectId}
              routeUrls={routeUrls.map((r: { url: string }) => r.url)}
            />
          </div>
        </section>
      )}

      {/* Route Stability section */}
      <section className="mb-8">
        <h2
          className="mb-3 text-sm font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
        >
          Route Stability
        </h2>
        <StabilityScoreList
          scores={stabilityScores ?? []}
          onSelectRoute={(route) => setSelectedRoute(route)}
        />
        {selectedRoute && flipHistory && flipHistory.length > 0 && (
          <div className="mt-4 s-glass p-5">
            <FlipHistoryChart
              data={flipHistory.map((d) => ({ passed: String(d.passed) === 'true', createdAt: String(d.createdAt) }))}
              routeLabel={`${selectedRoute.url} / ${selectedRoute.viewport}`}
            />
          </div>
        )}
      </section>

      {/* Component Health section */}
      <section>
        <h2
          className="mb-3 text-sm font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
        >
          Component Health
        </h2>
        <ComponentScoreList components={enrichedComponents} />
      </section>
    </div>
  );
}
