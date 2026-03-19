import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../trpc';
import { HealthTrendChart } from '../components/HealthTrendChart';
import { RegressionTrendChart } from '../components/RegressionTrendChart';
import { TeamMetricsCard } from '../components/TeamMetricsCard';
import { ExportButton } from '../components/ExportButton';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { generateProjectReport } from '../lib/export-pdf';
import { generateCsv, downloadCsv } from '../lib/export-csv';

function formatDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

export function AnalyticsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const safeProjectId = projectId ?? '';
  const [windowDays, setWindowDays] = useState<'7' | '30' | '60' | '90'>('30');

  const healthWindowDays = windowDays === '60' ? '90' : windowDays;

  const { data: healthTrendData, isLoading: loadingHealth } = useQuery(
    trpc.healthScores.trend.queryOptions({
      projectId: safeProjectId,
      windowDays: healthWindowDays,
    }),
  );

  const analyticsWindowDays = windowDays === '7' ? '30' : windowDays;

  const { data: regressionTrendData, isLoading: loadingRegression } = useQuery(
    trpc.analytics.regressionTrend.queryOptions({
      projectId: safeProjectId,
      windowDays: analyticsWindowDays,
    }),
  );

  const { data: teamMetricsData, isLoading: loadingMetrics } = useQuery(
    trpc.analytics.teamMetrics.queryOptions({
      projectId: safeProjectId,
      windowDays: analyticsWindowDays,
    }),
  );

  const healthChartData = useMemo(
    () =>
      (healthTrendData ?? []).map((d: { computedAt: Date | string; score: number }) => ({
        date: formatDate(d.computedAt),
        score: d.score,
      })),
    [healthTrendData],
  );

  const regressionChartData = useMemo(
    () => regressionTrendData ?? [],
    [regressionTrendData],
  );

  const { data: diffExportData } = useQuery(
    trpc.analytics.diffExport.queryOptions({
      projectId: safeProjectId,
      windowDays: analyticsWindowDays,
    }),
  );

  const handleExportPdf = useCallback(() => {
    generateProjectReport({
      projectName: safeProjectId,
      generatedAt: new Date().toISOString().slice(0, 10),
      windowDays: parseInt(windowDays, 10),
      healthTrend: healthChartData,
      regressionTrend: regressionChartData,
      teamMetrics: {
        meanTimeToApproveMs: teamMetricsData?.meanTimeToApproveMs ?? null,
        approvalVelocity: teamMetricsData?.approvalVelocity ?? 0,
        totalApprovals: teamMetricsData?.totalApprovals ?? 0,
      },
    });
  }, [safeProjectId, windowDays, healthChartData, regressionChartData, teamMetricsData]);

  const handleExportCsv = useCallback(() => {
    const rows = (diffExportData ?? []).map((d) => [
      d.url,
      d.viewport,
      d.pixelDiffPercent,
      d.passed,
      d.diffCreatedAt,
      d.approvalAction,
      d.approvalDate,
      d.approverEmail,
    ]);
    const headers = ['URL', 'Viewport', 'Pixel Diff %', 'Passed', 'Created At', 'Approval Action', 'Approval Date', 'Approver Email'];
    const csv = generateCsv(headers, rows);
    downloadCsv(`sentinel-export-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [diffExportData]);

  const isLoading = loadingHealth || loadingRegression || loadingMetrics;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <LoadingState message="Loading analytics..." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 s-animate-in">
      <PageHeader title="Analytics" />

      {/* Time range selector */}
      <div className="mb-6 mt-5 flex gap-1.5">
        {(['7', '30', '60', '90'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setWindowDays(range)}
            className={windowDays === range ? 's-pill s-pill-active' : 's-pill s-pill-inactive'}
          >
            {range}d
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2 s-stagger">
        <div className="s-card-elevated p-5">
          <h2
            className="mb-3 text-sm font-semibold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
          >
            Health Score Trend
          </h2>
          <HealthTrendChart data={healthChartData} />
        </div>

        <div className="s-card-elevated p-5">
          <h2
            className="mb-3 text-sm font-semibold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
          >
            Regression Trend
          </h2>
          <RegressionTrendChart data={regressionChartData} />
        </div>
      </div>

      {/* Team Metrics */}
      <section className="s-card-elevated p-5">
        <h2
          className="mb-3 text-sm font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
        >
          Team Metrics
        </h2>
        <TeamMetricsCard
          meanTimeToApproveMs={teamMetricsData?.meanTimeToApproveMs ?? null}
          approvalVelocity={teamMetricsData?.approvalVelocity ?? 0}
          totalApprovals={teamMetricsData?.totalApprovals ?? 0}
          windowDays={parseInt(windowDays, 10)}
        />
      </section>

      {/* Sticky export bar */}
      <div
        data-testid="export-bar"
        className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-3"
        style={{ background: 'var(--s-bg-surface)', borderTop: '1px solid var(--s-border)' }}
      >
        <ExportButton onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} />
      </div>
    </div>
  );
}
