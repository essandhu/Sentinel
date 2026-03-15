import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../trpc';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { DataTable } from '../components/ui/DataTable';
import type { DataTableColumn } from '../components/ui/DataTable';
import { EnvironmentSelector } from '../components/EnvironmentSelector';
import { EnvironmentDiffView } from '../components/EnvironmentDiffView';

interface RouteEntry {
  url: string;
  viewport: string;
  browser: string;
}

export function EnvironmentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const safeProjectId = projectId ?? '';

  const [selectedEnvs, setSelectedEnvs] = useState<{
    sourceEnv: string;
    targetEnv: string;
  } | null>(null);

  const [selectedRoute, setSelectedRoute] = useState<RouteEntry | null>(null);

  const { data: environments, isLoading: loadingEnvs } = useQuery(
    trpc.environments.list.queryOptions({ projectId: safeProjectId }),
  );

  const { data: sourceRoutes, isLoading: loadingSourceRoutes } = useQuery(
    trpc.environments.listRoutes.queryOptions(
      { projectId: safeProjectId, environmentName: selectedEnvs?.sourceEnv ?? '' },
    ),
  );

  const { data: targetRoutes, isLoading: loadingTargetRoutes } = useQuery(
    trpc.environments.listRoutes.queryOptions(
      { projectId: safeProjectId, environmentName: selectedEnvs?.targetEnv ?? '' },
    ),
  );

  const commonRoutes = useMemo<RouteEntry[]>(() => {
    if (!sourceRoutes || !targetRoutes) return [];
    const targetSet = new Set(
      targetRoutes.map((r) => `${r.url}|${r.viewport}|${r.browser}`),
    );
    return sourceRoutes.filter(
      (r) => targetSet.has(`${r.url}|${r.viewport}|${r.browser}`),
    );
  }, [sourceRoutes, targetRoutes]);

  function handleEnvSelect(sourceEnv: string, targetEnv: string) {
    setSelectedEnvs({ sourceEnv, targetEnv });
    setSelectedRoute(null);
  }

  const routeColumns: DataTableColumn<RouteEntry>[] = [
    {
      key: 'url',
      header: 'URL',
      render: (item) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item.url}</span>
      ),
    },
    { key: 'viewport', header: 'Viewport', render: (item) => item.viewport },
    { key: 'browser', header: 'Browser', render: (item) => item.browser },
    {
      key: 'action',
      header: '',
      render: (item) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSelectedRoute(item); }}
          className="s-btn s-btn-primary"
          style={{ fontSize: 11, padding: '3px 10px' }}
        >
          Compare
        </button>
      ),
      className: 'text-right',
    },
  ];

  if (loadingEnvs) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <LoadingState message="Loading environments..." />
      </div>
    );
  }

  if (!environments || environments.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 s-animate-in">
        <PageHeader title="Environment Comparison" />
        <div className="mt-6">
          <EmptyState title="No environments defined yet" description="Add environments in Settings to start comparing across deployments." />
        </div>
      </div>
    );
  }

  const loadingRoutes = selectedEnvs && (loadingSourceRoutes || loadingTargetRoutes);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 s-animate-in">
      <PageHeader title="Environment Comparison" />

      <section className="mt-6">
        <EnvironmentSelector projectId={safeProjectId} onSelect={handleEnvSelect} />
      </section>

      {selectedEnvs && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}>
            Routes available in both environments
          </h2>

          {loadingRoutes ? (
            <LoadingState message="Loading routes..." />
          ) : commonRoutes.length === 0 ? (
            <div className="s-glass p-6 text-center">
              <p className="text-[13px]" style={{ color: 'var(--s-text-tertiary)' }}>
                No common routes found between{' '}
                <span className="font-medium" style={{ color: 'var(--s-text-secondary)' }}>{selectedEnvs.sourceEnv}</span> and{' '}
                <span className="font-medium" style={{ color: 'var(--s-text-secondary)' }}>{selectedEnvs.targetEnv}</span>.
              </p>
            </div>
          ) : (
            <div className="s-glass overflow-hidden">
              <DataTable
                data={commonRoutes}
                columns={routeColumns}
                rowKey={(item) => `${item.url}|${item.viewport}|${item.browser}`}
                onRowClick={(item) => setSelectedRoute(item)}
                emptyMessage="No routes found"
              />
            </div>
          )}
        </section>
      )}

      {selectedEnvs && selectedRoute && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}>
            Comparison: {selectedRoute.url}
          </h2>
          <div className="s-glass p-5">
            <EnvironmentDiffView
              projectId={safeProjectId}
              sourceEnv={selectedEnvs.sourceEnv}
              targetEnv={selectedEnvs.targetEnv}
              url={selectedRoute.url}
              viewport={selectedRoute.viewport}
              browser={selectedRoute.browser}
            />
          </div>
        </section>
      )}
    </div>
  );
}
