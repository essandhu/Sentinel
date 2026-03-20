export interface AttentionItem {
  id: string;
  type: 'failing-diff' | 'regression' | 'schedule-missed' | 'run-complete' | 'health-change';
  title: string;
  description: string;
  priority: 'critical' | 'warning' | 'info' | 'success';
  count: number;
}

interface AttentionQueueProps {
  items: AttentionItem[];
  onItemClick: (item: AttentionItem) => void;
}

const dotClass: Record<AttentionItem['priority'], string> = {
  critical: 's-dot-danger-pulse',
  warning: 's-dot-warning',
  info: 's-dot',
  success: 's-dot-success',
};

export function AttentionQueue({ items, onItemClick }: AttentionQueueProps) {
  if (items.length === 0) {
    return (
      <div className="s-card-recessed" data-testid="attention-empty">
        <div className="flex items-center gap-2">
          <span className="s-dot-success" />
          <span className="text-[13px] text-[var(--color-text-secondary)]">
            Nothing needs attention
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 s-stagger">
      {items.map((item) => (
        <div
          key={item.id}
          data-testid="attention-item"
          role="button"
          tabIndex={0}
          className={`s-card-elevated s-priority-${item.priority} flex items-center gap-3 cursor-pointer`}
          onClick={() => onItemClick(item)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onItemClick(item);
          }}
        >
          <span className={dotClass[item.priority]} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium">{item.title}</div>
            <div className="text-[12px] text-[var(--color-text-tertiary)] truncate">
              {item.description}
            </div>
          </div>
          {item.count > 0 && (
            <span className="font-mono text-[var(--color-text-secondary)]">
              {item.count}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
