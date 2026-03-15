import { useQuery } from '@tanstack/react-query';
import { trpc } from '../trpc';
import { JiraLink } from './JiraLink';

interface AuditTimelineProps {
  diffId: string;
}

const actionColors: Record<string, string> = {
  approved: 'var(--s-success)',
  rejected: 'var(--s-danger)',
  deferred: 'var(--s-warning)',
};

const actionLabels: Record<string, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  deferred: 'Deferred',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AuditTimeline({ diffId }: AuditTimelineProps) {
  const { data: entries } = useQuery(
    trpc.approvals.history.queryOptions({ diffReportId: diffId }),
  );

  if (!entries || entries.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      {entries.map((entry: { id: string; action: string; userEmail: string; createdAt: string; reason?: string | null; jiraIssueKey?: string | null }) => (
        <div key={entry.id} className="flex items-start gap-2 text-xs">
          <span
            className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: actionColors[entry.action] ?? 'var(--s-text-tertiary)' }}
          />
          <div>
            <span className="font-medium">{actionLabels[entry.action] ?? entry.action}</span>
            {' by '}
            <span style={{ color: 'var(--s-text-secondary)' }}>{entry.userEmail}</span>
            <span className="ml-1" style={{ color: 'var(--s-text-tertiary)' }}>{relativeTime(entry.createdAt)}</span>
            {entry.reason && (
              <div className="ml-4" style={{ color: 'var(--s-text-secondary)' }}>{entry.reason}</div>
            )}
            {entry.action === 'rejected' && entry.jiraIssueKey && (
              <JiraLink issueKey={entry.jiraIssueKey} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
