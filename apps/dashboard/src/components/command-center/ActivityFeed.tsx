import { formatDistanceToNow } from './time-utils';

export interface ActivityItem {
  id: string;
  type: 'run-completed' | 'approval' | 'health-change' | 'regression';
  message: string;
  timestamp: string;
}

const dotColorMap: Record<ActivityItem['type'], string> = {
  'run-completed': 'var(--s-success)',
  'approval': 'var(--s-accent)',
  'health-change': 'var(--s-warning)',
  'regression': 'var(--s-danger)',
};

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--s-text-tertiary)' }}>
        No recent activity
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.25rem 0.5rem',
            borderRadius: 4,
            cursor: 'default',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--s-bg-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: dotColorMap[item.type],
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 13,
              color: 'var(--s-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {item.message}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--s-text-tertiary)',
              fontFamily: 'var(--s-font-mono, monospace)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {formatDistanceToNow(item.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}
