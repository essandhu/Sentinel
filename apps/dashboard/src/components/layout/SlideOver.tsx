import { useEffect } from 'react';
import { useSlideOver } from '../../hooks/useSlideOver';

export function SlideOver() {
  const { isOpen, content, title, close } = useSlideOver();

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="slide-over-panel"
      className="s-slide-over-enter flex flex-col h-full"
      style={{
        width: '55%',
        minWidth: 400,
        maxWidth: 800,
        background: 'var(--s-bg-base)',
        borderLeft: '1px solid var(--s-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid var(--s-border)' }}
      >
        <h2
          className="font-display text-sm font-semibold"
          style={{ fontSize: 14 }}
        >
          {title}
        </h2>
        <button
          onClick={close}
          aria-label="Close panel"
          className="p-1 rounded hover:opacity-70"
          style={{ color: 'var(--s-text-secondary)' }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {content}
      </div>
    </div>
  );
}
