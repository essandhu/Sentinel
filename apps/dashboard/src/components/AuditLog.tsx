import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../trpc';

interface AuditLogProps {
  runId: string;
}

const actionBadges: Record<string, { bg: string; color: string }> = {
  approved: { bg: 'var(--s-success-dim)', color: 'var(--s-success)' },
  rejected: { bg: 'var(--s-danger-dim)', color: 'var(--s-danger)' },
  deferred: { bg: 'var(--s-warning-dim)', color: 'var(--s-warning)' },
};

export function AuditLog({ runId }: AuditLogProps) {
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');

  const { data: entries, isLoading } = useQuery(
    trpc.approvals.history.queryOptions({ runId }),
  );

  const filtered = (entries ?? [])
    .filter((e: { action: string; userEmail: string }) => {
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      if (userFilter && !e.userEmail.toLowerCase().includes(userFilter.toLowerCase())) return false;
      return true;
    });

  return (
    <div className="s-glass rounded-lg p-4">
      <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--s-text-primary)' }}>Audit Log</h3>

      <div className="mb-3 flex gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="s-input rounded px-2 py-1 text-xs"
        >
          <option value="all">All actions</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="deferred">Deferred</option>
        </select>
        <input
          type="text"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          placeholder="Filter by user..."
          className="s-input flex-1 rounded px-2 py-1 text-xs"
        />
      </div>

      {isLoading && <div className="text-xs" style={{ color: 'var(--s-text-tertiary)' }}>Loading...</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="text-xs" style={{ color: 'var(--s-text-tertiary)' }}>No audit entries</div>
      )}

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {filtered.map((entry: { id: string; action: string; userEmail: string; createdAt: string; reason?: string | null; diffReportId: string }) => {
          const badge = actionBadges[entry.action] ?? { bg: 'var(--s-bg-raised)', color: 'var(--s-text-secondary)' };
          return (
            <div key={entry.id} className="flex items-start gap-2 rounded p-2 text-xs" style={{ border: '1px solid var(--s-border)' }}>
              <span
                className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ background: badge.bg, color: badge.color }}
              >
                {entry.action}
              </span>
              <div className="flex-1">
                <span style={{ color: 'var(--s-text-secondary)' }}>{entry.userEmail}</span>
                <span className="ml-2" style={{ color: 'var(--s-text-tertiary)' }}>{new Date(entry.createdAt).toLocaleString()}</span>
                {entry.reason && <div className="mt-0.5" style={{ color: 'var(--s-text-secondary)' }}>{entry.reason}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
