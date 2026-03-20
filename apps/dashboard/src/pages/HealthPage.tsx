import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { trpc } from '../trpc';
import { HealthHeroSection } from '../components/HealthHeroSection';
import { HealthTrendChart } from '../components/HealthTrendChart';
import { HealthMetricGrid } from '../components/HealthMetricGrid';
import { ComponentScoreList } from '../components/ComponentScoreList';
import { NeedsAttention } from '../components/NeedsAttention';
import { FlipHistoryChart } from '../components/FlipHistoryChart';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

function formatDate(d: Date | string | number): string {
  const dt = d instanceof Date ? d : new Date(d);
  return `${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getDate().toString().padStart(2, '0')}`;
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

  const a11yScore = a11yData && a11yData.totalViolations > 0
    ? Math.round(((a11yData.totalViolations - a11yData.newCount) / a11yData.totalViolations) * 100)
    : 100;
  const breakdown = a11yData?.latestRunId
    ? { visual: projectScore?.score ?? 0, accessibility: a11yScore }
    : undefined;
  const trendSummary = formattedTrend.length >= 2
    ? formattedTrend[0].score === formattedTrend[formattedTrend.length - 1].score
      ? `Stable over the last ${timeRange} days`
      : `Changed over the last ${timeRange} days`
    : `Tracking over the last ${timeRange} days`;

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

      {/* Hero Section */}
      <div className="mb-8 mt-6 s-stagger">
        <HealthHeroSection
          score={projectScore.score}
          breakdown={breakdown}
          trendSummary={trendSummary}
        />
      </div>

      {/* Score Trend */}
      <section className="mb-8 s-card-default p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}>
            Score Trend
          </h2>
          <div className="flex gap-1.5">
            {(['7', '30', '90'] as const).map((range) => (
              <button key={range} onClick={() => setTimeRange(range)}
                className={timeRange === range ? 's-pill s-pill-active' : 's-pill s-pill-inactive'}>
                {range}d
              </button>
            ))}
          </div>
        </div>
        <HealthTrendChart data={formattedTrend} />
      </section>

      {/* 2x2 Metric Grid */}
      <section className="mb-8">
        <HealthMetricGrid visualScore={projectScore.score} a11yScore={a11yScore}
          a11yViolationCount={a11yData?.totalViolations ?? 0} projectId={safeProjectId}
          routeUrls={(routeUrls ?? []).map((r: { url: string }) => r.url)}
          stabilityScores={stabilityScores ?? []} onSelectRoute={setSelectedRoute} />
      </section>

      {/* Flip History (when route selected) */}
      {selectedRoute && flipHistory && flipHistory.length > 0 && (
        <section className="mb-8 s-card-default p-5">
          <FlipHistoryChart routeLabel={`${selectedRoute.url} / ${selectedRoute.viewport}`}
            data={flipHistory.map((d) => ({ passed: String(d.passed) === 'true', createdAt: String(d.createdAt) }))} />
        </section>
      )}

      {/* Needs Attention */}
      {attentionItems.length > 0 && (
        <section className="mb-8 s-card-default p-5">
          <h2 className="mb-3 text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}>
            Needs Attention
          </h2>
          <NeedsAttention items={attentionItems} />
        </section>
      )}

      {/* Component Health */}
      <section>
        <h2 className="mb-3 text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}>
          Component Health
        </h2>
        <ComponentScoreList components={enrichedComponents} />
      </section>
    </div>
  );
}
