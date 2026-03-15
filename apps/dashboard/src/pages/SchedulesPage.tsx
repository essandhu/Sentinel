import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { trpc, trpcClient, queryClient } from '../trpc';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

interface ScheduleItem {
  id: string;
  projectId: string;
  name: string;
  cronExpression: string;
  cronDescription: string;
  timezone: string;
  configPath: string;
  enabled: number;
  lastRunAt: Date | string | null;
  lastRunStatus: string | null;
  nextRun: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface HistoryItem {
  id: string;
  status: string;
  source: string | null;
  createdAt: Date | string;
  completedAt: Date | string | null;
}

const statusDotClass: Record<string, string> = {
  completed: 's-dot s-dot-success',
  failed: 's-dot s-dot-danger',
  pending: 's-dot s-dot-warning',
  running: 's-dot s-dot-info',
};

const cronPresets = [
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at 3 AM', value: '0 3 * * *' },
  { label: 'Weekly Monday 9 AM', value: '0 9 * * 1' },
  { label: 'Every 12 hours', value: '0 */12 * * *' },
];

function ScheduleHistory({ scheduleId }: { scheduleId: string }) {
  const { data: runs, isLoading } = useQuery(
    trpc.schedules.history.queryOptions({ scheduleId }),
  );

  if (isLoading) {
    return <div className="py-3 text-center text-[11px]" style={{ color: 'var(--s-text-tertiary)' }}>Loading history...</div>;
  }

  const items = runs as HistoryItem[] | undefined;

  if (!items || items.length === 0) {
    return <div className="py-3 text-center text-[11px]" style={{ color: 'var(--s-text-tertiary)' }}>No runs yet</div>;
  }

  return (
    <div className="mt-2 space-y-1">
      {items.map((run) => {
        const createdAt = new Date(run.createdAt);
        const completedAt = run.completedAt ? new Date(run.completedAt) : null;
        const duration = completedAt
          ? Math.round((completedAt.getTime() - createdAt.getTime()) / 1000)
          : null;

        return (
          <div
            key={run.id}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-[11px]"
            style={{ background: 'var(--s-bg-raised)' }}
          >
            <span style={{ color: 'var(--s-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {createdAt.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              {duration !== null && (
                <span style={{ color: 'var(--s-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{duration}s</span>
              )}
              <span className="flex items-center gap-1.5">
                <span className={statusDotClass[run.status] ?? 's-dot'} />
                <span style={{ color: 'var(--s-text-secondary)' }}>{run.status}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SchedulesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const safeProjectId = projectId ?? '';

  const [name, setName] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [configPath, setConfigPath] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: schedules, isLoading } = useQuery(
    trpc.schedules.list.queryOptions({ projectId: safeProjectId }),
  );

  const createMutation = useMutation({
    mutationFn: async (data: {
      projectId: string;
      name: string;
      cronExpression: string;
      configPath: string;
      timezone: string;
    }) => {
      return trpcClient.schedules.create.mutate(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['schedules', 'list']] });
      setName('');
      setCronExpression('');
      setConfigPath('');
      setTimezone('UTC');
      setShowForm(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (data: { id: string; enabled: boolean }) => {
      return trpcClient.schedules.toggle.mutate(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['schedules', 'list']] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (data: { id: string }) => {
      return trpcClient.schedules.delete.mutate(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['schedules', 'list']] });
      setDeleteConfirmId(null);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cronExpression.trim() || !configPath.trim()) return;
    createMutation.mutate({
      projectId: safeProjectId,
      name: name.trim(),
      cronExpression: cronExpression.trim(),
      configPath: configPath.trim(),
      timezone,
    });
  };

  const handleToggle = (schedule: ScheduleItem) => {
    toggleMutation.mutate({
      id: schedule.id,
      enabled: schedule.enabled !== 1,
    });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 s-animate-in">
      <PageHeader
        title="Schedules"
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className={showForm ? 's-btn s-btn-secondary' : 's-btn s-btn-primary'}
          >
            {showForm ? 'Cancel' : 'Create Schedule'}
          </button>
        }
      />

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 mt-6 s-glass p-5 s-animate-in-scale">
          <p className="s-section-label">New Schedule</p>
          <div className="space-y-3 mt-2">
            <div>
              <label className="s-input-label">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nightly Capture" required className="s-input" />
            </div>
            <div>
              <label className="s-input-label">Cron Expression</label>
              <input type="text" value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} placeholder="0 3 * * *" required className="s-input" style={{ fontFamily: 'var(--font-mono)' }} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {cronPresets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setCronExpression(preset.value)}
                    className="s-pill s-pill-inactive"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="s-input-label">Config Path</label>
              <input type="text" value={configPath} onChange={(e) => setConfigPath(e.target.value)} placeholder="sentinel.config.json" required className="s-input" style={{ fontFamily: 'var(--font-mono)' }} />
            </div>
            <div>
              <label className="s-input-label">Timezone</label>
              <input type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC" className="s-input" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={createMutation.isPending} className="s-btn s-btn-primary">
              {createMutation.isPending ? 'Creating...' : 'Create Schedule'}
            </button>
          </div>
        </form>
      )}

      {isLoading && <LoadingState message="Loading schedules..." />}

      {!isLoading && schedules && (schedules as ScheduleItem[]).length === 0 && (
        <div className="mt-6">
          <EmptyState title="No schedules configured" description="Create a schedule to automate captures." />
        </div>
      )}

      {!isLoading && schedules && (schedules as ScheduleItem[]).length > 0 && (
        <div className="mt-6 space-y-2 s-stagger">
          {(schedules as ScheduleItem[]).map((schedule) => (
            <div key={schedule.id} className="s-glass p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[13px] font-semibold" style={{ color: 'var(--s-text-primary)' }}>{schedule.name}</h3>
                    <span
                      className="rounded px-2 py-0.5 text-[11px]"
                      style={{ background: 'var(--s-bg-raised)', color: 'var(--s-text-secondary)', fontFamily: 'var(--font-mono)' }}
                    >
                      {schedule.cronDescription}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-[11px]" style={{ color: 'var(--s-text-tertiary)' }}>
                    {schedule.nextRun && <span>Next: {new Date(schedule.nextRun).toLocaleString()}</span>}
                    {schedule.lastRunAt && (
                      <span className="flex items-center gap-1.5">
                        Last: {new Date(schedule.lastRunAt).toLocaleString()}
                        {schedule.lastRunStatus && (
                          <span className={statusDotClass[schedule.lastRunStatus] ?? 's-dot'} />
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <button
                    onClick={() => handleToggle(schedule)}
                    disabled={toggleMutation.isPending}
                    className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200"
                    style={{ background: schedule.enabled === 1 ? 'var(--s-accent)' : 'var(--s-bg-hover)' }}
                    title={schedule.enabled === 1 ? 'Disable' : 'Enable'}
                  >
                    <span
                      className="pointer-events-none inline-block h-4 w-4 rounded-full shadow transition duration-200"
                      style={{
                        background: schedule.enabled === 1 ? 'var(--s-text-inverse)' : 'var(--s-text-tertiary)',
                        transform: schedule.enabled === 1 ? 'translateX(16px) translateY(2px)' : 'translateX(2px) translateY(2px)',
                      }}
                    />
                  </button>

                  <button
                    onClick={() => setExpandedId(expandedId === schedule.id ? null : schedule.id)}
                    className="s-btn s-btn-ghost"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                  >
                    {expandedId === schedule.id ? 'Hide History' : 'History'}
                  </button>

                  {deleteConfirmId === schedule.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(schedule.id)} disabled={deleteMutation.isPending} className="s-btn s-btn-danger" style={{ fontSize: 11, padding: '3px 8px' }}>
                        Confirm
                      </button>
                      <button onClick={() => setDeleteConfirmId(null)} className="s-btn s-btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirmId(schedule.id)} className="s-btn s-btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: 'var(--s-danger)' }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {expandedId === schedule.id && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--s-border)' }}>
                  <ScheduleHistory scheduleId={schedule.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
