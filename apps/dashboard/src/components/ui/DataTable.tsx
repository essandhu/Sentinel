import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  onRowClick?: (item: T) => void;
  rowKey: (item: T) => string;
  emptyMessage?: string;
  rowClassName?: (item: T, index: number) => string;
}

export function DataTable<T>({
  data,
  columns,
  onRowClick,
  rowKey,
  emptyMessage = 'No data',
  rowClassName,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: 'var(--s-text-tertiary)' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--s-border)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider ${col.className ?? ''}`}
                style={{ color: 'var(--s-text-tertiary)', fontFamily: 'var(--font-body)' }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={rowKey(item)}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={`transition-colors duration-100 ${
                onRowClick ? 'cursor-pointer' : ''
              } ${rowClassName ? rowClassName(item, index) : ''}`}
              style={{
                borderBottom: '1px solid var(--s-border)',
              }}
              onMouseEnter={(e) => {
                if (onRowClick) (e.currentTarget as HTMLElement).style.background = 'var(--s-bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`whitespace-nowrap px-5 py-3.5 text-[13px] ${col.className ?? ''}`}
                  style={{ color: 'var(--s-text-primary)' }}
                >
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
