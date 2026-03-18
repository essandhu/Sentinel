import { createElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { trpc } from '../trpc';
import { useSlideOver } from '../hooks/useSlideOver';
import { StatusStrip } from '../components/command-center/StatusStrip';
import { AttentionQueue, type AttentionItem } from '../components/command-center/AttentionQueue';
import { ActivityFeed } from '../components/command-center/ActivityFeed';
import { DataTable } from '../components/ui/DataTable';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import {
  type RunListItem,
  computeStatusStrip,
  buildAttentionItems,
  buildActivityItems,
  runColumns,
} from './command-center-helpers';

export function CommandCenterPage() {
  const { data: runs, isLoading } = useQuery(trpc.runs.list.queryOptions());
  const { data: projects } = useQuery(trpc.projects.list.queryOptions());
  const navigate = useNavigate();
  const slideOver = useSlideOver();

  const runList = (runs as RunListItem[] | undefined) ?? [];
  const recentRuns = runList.slice(0, 10);

  const projectNames: Record<string, string> = {};
  if (projects) {
    for (const p of projects as any[]) {
      projectNames[p.id] = p.name;
    }
  }

  const statusData = computeStatusStrip(runList);
  const attentionItems = buildAttentionItems(runList);
  const activityItems = buildActivityItems(runList);

  const handleAttentionClick = (item: AttentionItem) => {
    slideOver.open(
      createElement('div', { className: 'p-4 space-y-2' },
        createElement('h3', { className: 'font-medium' }, item.title),
        createElement('p', { className: 'text-sm text-[var(--s-text-secondary)]' }, item.description),
      ),
      { title: item.title },
    );
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8 s-animate-in">
        <PageHeader title="Command Center" />
        <LoadingState message="Loading dashboard..." />
      </div>
    );
  }

  if (runList.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8 s-animate-in">
        <PageHeader title="Command Center" />
        <div className="mt-6">
          <EmptyState
            title="No results"
            description="No capture runs found. Run a capture to see results here."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 s-animate-in">
      {/* Row 1: Header + StatusStrip */}
      <PageHeader title="Command Center" />
      <div className="mt-4">
        <StatusStrip data={statusData} />
      </div>

      {/* Row 2: AttentionQueue + ActivityFeed */}
      <div className="mt-8 grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <h2 className="s-section-label mb-3">Needs Attention</h2>
          <AttentionQueue items={attentionItems} onItemClick={handleAttentionClick} />
        </div>
        <div className="col-span-2">
          <h2 className="s-section-label mb-3">Recent Activity</h2>
          <ActivityFeed items={activityItems} />
        </div>
      </div>

      {/* Row 3: Recent Runs */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="s-section-label">Recent Runs</h2>
          <Link
            to="/runs"
            className="text-[12px] transition-colors hover:text-[var(--s-accent)]"
            style={{ color: 'var(--s-text-secondary)' }}
          >
            View all runs
          </Link>
        </div>
        <div className="s-glass overflow-hidden">
          <DataTable<RunListItem>
            data={recentRuns}
            columns={runColumns(projectNames)}
            rowKey={(run) => run.id}
            onRowClick={(run) => navigate(`/runs/${run.id}`)}
          />
        </div>
      </div>
    </div>
  );
}
