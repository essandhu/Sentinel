import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-1 items-center justify-between gap-3">
      <h1
        className="text-xl font-bold tracking-tight"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
      >
        {title}
      </h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
