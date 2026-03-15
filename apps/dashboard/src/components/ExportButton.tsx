import { useState, useRef, useEffect } from 'react';

interface ExportButtonProps {
  onExportPdf: () => void;
  onExportCsv: () => void;
  loading?: boolean;
}

export function ExportButton({ onExportPdf, onExportCsv, loading }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={loading}
        className="s-btn s-btn-primary inline-flex items-center gap-2"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {loading ? (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            data-testid="export-spinner"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        Export
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 z-10 mt-1 w-52 rounded-lg s-glass overflow-hidden"
          style={{ border: '1px solid var(--s-border-strong)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)' }}
        >
          <button
            type="button"
            onClick={() => {
              onExportPdf();
              setOpen(false);
            }}
            className="w-full px-4 py-2.5 text-left text-[13px] transition-colors duration-100"
            style={{ color: 'var(--s-text-secondary)', fontFamily: 'var(--font-body)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--s-bg-hover)'; e.currentTarget.style.color = 'var(--s-text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--s-text-secondary)'; }}
          >
            Download PDF Report
          </button>
          <button
            type="button"
            onClick={() => {
              onExportCsv();
              setOpen(false);
            }}
            className="w-full px-4 py-2.5 text-left text-[13px] transition-colors duration-100"
            style={{ color: 'var(--s-text-secondary)', fontFamily: 'var(--font-body)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--s-bg-hover)'; e.currentTarget.style.color = 'var(--s-text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--s-text-secondary)'; }}
          >
            Export CSV Data
          </button>
        </div>
      )}
    </div>
  );
}
