import {
  createContext,
  useContext,
  useState,
  useCallback,
  createElement,
} from 'react';
import type { ReactNode } from 'react';

interface SlideOverContextValue {
  isOpen: boolean;
  content: ReactNode | null;
  title: string;
  open: (content: ReactNode, options: { title: string }) => void;
  close: () => void;
}

const SlideOverContext = createContext<SlideOverContextValue | null>(null);

export function SlideOverProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<ReactNode | null>(null);
  const [title, setTitle] = useState('');

  const open = useCallback((newContent: ReactNode, options: { title: string }) => {
    setContent(newContent);
    setTitle(options.title);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setContent(null);
    setTitle('');
  }, []);

  const value: SlideOverContextValue = {
    isOpen,
    content,
    title,
    open,
    close,
  };

  return createElement(SlideOverContext, { value }, children);
}

export function useSlideOver(): SlideOverContextValue {
  const ctx = useContext(SlideOverContext);
  if (!ctx) {
    throw new Error('useSlideOver must be used within a SlideOverProvider');
  }
  return ctx;
}
