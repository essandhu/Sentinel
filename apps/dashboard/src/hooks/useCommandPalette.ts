import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  createElement,
} from 'react';
import type { ReactNode } from 'react';

export interface CommandAction {
  id: string;
  label: string;
  shortcut?: string;
  icon?: string;
  section: string;
  onExecute: () => void;
  available?: () => boolean;
}

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  actions: Map<string, CommandAction>;
  registerAction: (action: CommandAction) => void;
  unregisterAction: (id: string) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [actions, setActions] = useState(() => new Map<string, CommandAction>());

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const registerAction = useCallback((action: CommandAction) => {
    setActions((prev) => {
      const next = new Map(prev);
      next.set(action.id, action);
      return next;
    });
  }, []);

  const unregisterAction = useCallback((id: string) => {
    setActions((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Global Cmd/Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const value: CommandPaletteContextValue = {
    isOpen,
    open,
    close,
    toggle,
    actions,
    registerAction,
    unregisterAction,
  };

  return createElement(CommandPaletteContext.Provider, { value }, children);
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return ctx;
}
