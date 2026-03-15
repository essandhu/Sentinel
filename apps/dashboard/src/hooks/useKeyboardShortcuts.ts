import { useEffect, useRef } from 'react';

export type ShortcutMap = Record<string, () => void>;

const GUARDED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Registers global keyboard shortcuts that fire when the user presses a key
 * outside of text inputs, selects, contentEditable elements, and the command palette.
 *
 * @param shortcuts - Map of key names (e.g. 'j', 'k', 'Escape') to handler functions
 * @param enabled - When false, all shortcuts are disabled (default true)
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target instanceof HTMLElement ? e.target : null;

      // Guard: don't fire when typing in form fields
      if (target && GUARDED_TAGS.has(target.tagName)) return;

      // Guard: don't fire in contentEditable elements
      if (target?.getAttribute('contenteditable') === 'true') return;

      // Guard: don't fire when command palette is open
      if (document.querySelector('[data-command-palette]')) return;

      const handler = shortcutsRef.current[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
