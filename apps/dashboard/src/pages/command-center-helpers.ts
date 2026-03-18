import { createElement } from 'react';
import { Link } from 'react-router-dom';
import type { StatusStripData } from '../components/command-center/StatusStrip';
import type { AttentionItem } from '../components/command-center/AttentionQueue';
import type { ActivityItem } from '../components/command-center/ActivityFeed';
import type { DataTableColumn } from '../components/ui/DataTable';

export interface RunListItem {
  id: string;
  projectId: string;
  branchName: string | null;
  commitSha: string | null;
  status: string;
  createdAt: Date | string;
  completedAt: Date | string | null;
  totalDiffs: number;
  suiteName: string | null;
}

const statusDotClass: Record<string, string> = {
  pending: 's-dot s-dot-warning',
  running: 's-dot s-dot-info',
  completed: 's-dot s-dot-success',
  failed: 's-dot s-dot-danger',
};

export const computeStatusStrip = (runs: RunListItem[]): StatusStripData => {
  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latest = sorted[0] ?? null;
  return {
    healthScore: 0,
    healthTrend: 0,
    pendingDiffs: runs.filter((r) => r.status === 'pending' || r.status === 'running').length,
    lastRunTime: latest ? String(latest.createdAt) : null,
    lastRunPassed: latest?.status === 'completed',
    newRegressions: runs.filter((r) => r.status === 'failed').length,
    regressionTrend: 0,
  };
};

export const buildAttentionItems = (runs: RunListItem[]): AttentionItem[] => {
  const items: AttentionItem[] = [];
  const failed = runs.filter((r) => r.status === 'failed');
  const pending = runs.filter((r) => r.status === 'pending' || r.status === 'running');

  for (const run of failed) {
    items.push({
      id: run.id,
      type: 'failing-diff',
      title: `Failed run on ${run.branchName ?? 'unknown'}`,
      description: `${run.totalDiffs} diffs detected`,
      priority: 'critical',
      count: run.totalDiffs,
    });
  }

  for (const run of pending) {
    items.push({
      id: run.id,
      type: 'run-complete',
      title: `${run.status === 'running' ? 'Running' : 'Pending'} on ${run.branchName ?? 'unknown'}`,
      description: 'Awaiting completion',
      priority: 'warning',
      count: 0,
    });
  }

  return items;
};

export const buildActivityItems = (runs: RunListItem[]): ActivityItem[] =>
  runs
    .filter((r) => r.status === 'completed')
    .map((r) => ({
      id: r.id,
      type: 'run-completed' as const,
      message: `Run on ${r.branchName ?? 'unknown'} completed`,
      timestamp: String(r.createdAt),
    }));

export const runColumns = (projectNames: Record<string, string>): DataTableColumn<RunListItem>[] => [
  {
    key: 'project',
    header: 'Project',
    render: (run) =>
      createElement(
        Link,
        {
          to: `/projects/${run.projectId}/health`,
          className: 'font-medium transition-colors hover:text-[var(--s-accent)]',
          style: { color: 'var(--s-text-primary)' },
        },
        projectNames[run.projectId] ?? run.projectId.slice(0, 8),
      ),
  },
  {
    key: 'branch',
    header: 'Branch',
    render: (run) => run.branchName ?? 'no branch',
  },
  {
    key: 'status',
    header: 'Status',
    render: (run) =>
      createElement(
        'span',
        { className: 'flex items-center gap-2' },
        createElement('span', { className: statusDotClass[run.status] ?? 's-dot' }),
        createElement(
          'span',
          { className: 'text-[12px] capitalize', style: { color: 'var(--s-text-secondary)' } },
          run.status,
        ),
      ),
  },
  {
    key: 'diffs',
    header: 'Diffs',
    render: (run) =>
      createElement(
        'span',
        {
          className: 'text-[13px] font-medium',
          style: {
            fontFamily: 'var(--font-mono)',
            color: run.totalDiffs > 0 ? 'var(--s-accent)' : 'var(--s-text-tertiary)',
          },
        },
        run.totalDiffs,
      ),
  },
  {
    key: 'date',
    header: 'Date',
    render: (run) =>
      createElement(
        'span',
        { style: { color: 'var(--s-text-tertiary)', fontSize: 12, fontFamily: 'var(--font-mono)' } },
        new Date(run.createdAt).toLocaleDateString(),
      ),
  },
];
