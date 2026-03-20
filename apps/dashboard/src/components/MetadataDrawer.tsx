import { useState } from 'react';

export interface MetadataDrawerProps {
  children: () => React.ReactNode;
  label?: string;
}

export function MetadataDrawer({ children, label = 'Details' }: MetadataDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-lg"
      style={{ border: '1px solid var(--s-border)' }}
      data-testid="metadata-drawer"
    >
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-[13px] font-medium"
        style={{ color: 'var(--s-text-secondary)' }}
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        >
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </button>
      {open && (
        <div className="px-4 pb-4 s-animate-in">
          {children()}
        </div>
      )}
    </div>
  );
}
