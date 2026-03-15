import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { trpc } from '../trpc';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { SuiteFilter } from '../components/SuiteFilter';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';

interface RunListItem {
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

const baseColumns: DataTableColumn<RunListItem>[] = [
  {
    key: 'branch',
    header: 'Branch',
    render: (run) => (
      <Link
        to={`/runs/${run.id}`}
        className="font-medium transition-colors hover:text-[var(--s-accent)]"
        style={{ color: 'var(--s-text-primary)' }}
      >
        {run.branchName ?? 'no branch'}
      </Link>
    ),
  },
  {
    key: 'commit',
    header: 'Commit',
    render: (run) => (
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--s-text-tertiary)', fontSize: 12 }}>
        {run.commitSha ? run.commitSha.slice(0, 7) : '-'}
      </span>
    ),
  },
  {
    key: 'suite',
    header: 'Suite',
    render: (run) => (
      <span style={{ color: 'var(--s-text-secondary)', fontSize: 13 }}>{run.suiteName ?? '-'}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (run) => (
      <span className="flex items-center gap-2">
        <span className={statusDotClass[run.status] ?? 's-dot'} style={!statusDotClass[run.status] ? { background: 'var(--s-text-tertiary)' } : {}} />
        <span className="text-[12px] capitalize" style={{ color: 'var(--s-text-secondary)' }}>
          {run.status}
        </span>
      </span>
    ),
  },
  {
    key: 'diffs',
    header: 'Diffs',
    render: (run) => (
      <span
        className="text-[13px] font-medium"
        style={{
          fontFamily: 'var(--font-mono)',
          color: run.totalDiffs > 0 ? 'var(--s-accent)' : 'var(--s-text-tertiary)',
        }}
      >
        {run.totalDiffs}
      </span>
    ),
  },
  {
    key: 'date',
    header: 'Date',
    render: (run) => (
      <span style={{ color: 'var(--s-text-tertiary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
        {new Date(run.createdAt).toLocaleDateString()}
      </span>
    ),
  },
];

export function RunsPage() {
  const { data: runs, isLoading } = useQuery(trpc.runs.list.queryOptions());
  const { data: projects } = useQuery(trpc.projects.list.queryOptions());

  // Build a lookup for project names
  const projectNames: Record<string, string> = {};
  if (projects) {
    for (const p of projects as any[]) {
      projectNames[p.id] = p.name;
    }
  }

  const columns: DataTableColumn<RunListItem>[] = [
    {
      key: 'project',
      header: 'Project',
      render: (run) => (
        <Link
          to={`/projects/${run.projectId}/health`}
          className="font-medium transition-colors hover:text-[var(--s-accent)]"
          style={{ color: 'var(--s-text-primary)' }}
        >
          {projectNames[run.projectId] ?? run.projectId.slice(0, 8)}
        </Link>
      ),
    },
    ...baseColumns,
  ];
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const navigate = useNavigate();

  const filteredRuns = selectedSuite
    ? (runs as RunListItem[] | undefined)?.filter((r) => r.suiteName === selectedSuite)
    : (runs as RunListItem[] | undefined);

  const runList = (filteredRuns as RunListItem[]) ?? [];

  const navigateToFocused = useCallback(() => {
    if (focusedIndex >= 0 && focusedIndex < runList.length) {
      navigate(`/runs/${runList[focusedIndex].id}`);
    }
  }, [focusedIndex, runList, navigate]);

  useKeyboardShortcuts(
    useMemo(
      () => ({
        j: () => setFocusedIndex((i) => Math.min(i + 1, runList.length - 1)),
        k: () => setFocusedIndex((i) => Math.max(i - 1, 0)),
        Enter: () => navigateToFocused(),
        Escape: () => setFocusedIndex(-1),
      }),
      [runList.length, navigateToFocused],
    ),
    !isLoading && runList.length > 0,
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 s-animate-in">
      <PageHeader title="Capture Runs" />

      {isLoading && <LoadingState message="Loading runs..." />}

      {!isLoading && runs && runs.length === 0 && (
        <div className="mt-6">
          <EmptyState title="No results" description="No capture runs found. Run a capture to see results here." />
        </div>
      )}

      {!isLoading && runs && runs.length > 0 && (
        <>
          <div className="mt-6">
            <SuiteFilter
              runs={runs as RunListItem[]}
              selected={selectedSuite}
              onChange={setSelectedSuite}
            />
          </div>
          <div className="mt-4 s-glass overflow-hidden">
            <DataTable<RunListItem>
              data={runList}
              columns={columns}
              rowKey={(run) => run.id}
              onRowClick={(run) => { navigate(`/runs/${run.id}`); }}
              rowClassName={(_item, index) =>
                index === focusedIndex ? 'ring-1 ring-[var(--s-accent)] ring-inset' : ''
              }
              emptyMessage="No runs match the selected filter"
            />
          </div>
        </>
      )}
    </div>
  );
}
