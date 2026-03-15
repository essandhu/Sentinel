import {
  createElement,
  createContext,
  useContext,
  type ReactNode,
} from 'react';

export type Theme = 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolved: 'dark';
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Dark-only: always ensure the class is present
  document.documentElement.classList.add('dark');

  const value: ThemeContextValue = {
    theme: 'dark',
    resolved: 'dark',
    setTheme: () => {}, // no-op — dark only
  };

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
