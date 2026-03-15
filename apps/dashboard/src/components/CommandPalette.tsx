import { useState, useEffect, useRef, useMemo } from 'react';
import { useCommandPalette } from '../hooks/useCommandPalette';
import type { CommandAction } from '../hooks/useCommandPalette';

export function CommandPalette() {
  const { isOpen, close, actions } = useCommandPalette();
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setHighlightedIndex(0);
      // Focus input after render
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Filter actions by query substring match
  const filteredActions = useMemo(() => {
    const allActions = Array.from(actions.values()).filter(
      (a) => !a.available || a.available(),
    );

    if (!query) return allActions;

    const lowerQuery = query.toLowerCase();
    return allActions.filter((a) => a.label.toLowerCase().includes(lowerQuery));
  }, [actions, query]);

  // Group by section
  const grouped = useMemo(() => {
    const groups = new Map<string, CommandAction[]>();
    for (const action of filteredActions) {
      const list = groups.get(action.section) || [];
      list.push(action);
      groups.set(action.section, list);
    }
    return groups;
  }, [filteredActions]);

  // Reset highlight when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filteredActions.length - 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const action = filteredActions[highlightedIndex];
      if (action) {
        action.onExecute();
        close();
      }
    }
  }

  if (!isOpen) return null;

  let actionIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={close}
    >
      <div
        className="mt-[18vh] w-full max-w-lg rounded-xl shadow-2xl s-animate-in-scale"
        style={{
          background: 'var(--s-bg-surface)',
          border: '1px solid var(--s-border-strong)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid var(--s-border)' }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--s-text-tertiary)"
            strokeWidth="1.5"
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command..."
            className="w-full bg-transparent text-[14px] outline-none"
            style={{
              color: 'var(--s-text-primary)',
              fontFamily: 'var(--font-body)',
            }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Action list */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredActions.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px]" style={{ color: 'var(--s-text-tertiary)' }}>
              No matching commands
            </p>
          )}

          {Array.from(grouped.entries()).map(([section, sectionActions]) => (
            <div key={section}>
              <p className="s-section-label px-3 pt-1">{section}</p>
              {sectionActions.map((action) => {
                const idx = actionIndex++;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={action.id}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] transition-colors"
                    style={{
                      background: isHighlighted ? 'var(--s-accent-dim)' : 'transparent',
                      color: isHighlighted ? 'var(--s-accent)' : 'var(--s-text-secondary)',
                    }}
                    onClick={() => {
                      action.onExecute();
                      close();
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    {action.icon && <span className="mr-2">{action.icon}</span>}
                    <span>{action.label}</span>
                    {action.shortcut && (
                      <span
                        className="ml-auto text-[11px]"
                        style={{ color: 'var(--s-text-tertiary)' }}
                      >
                        {action.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
