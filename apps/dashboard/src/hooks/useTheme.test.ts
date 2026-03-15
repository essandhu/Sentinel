import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { ThemeProvider, useTheme } from './useTheme';
import type { ReactNode } from 'react';

// Helper to wrap hook in ThemeProvider
function wrapper({ children }: { children: ReactNode }) {
  return createElement(ThemeProvider, null, children);
}

beforeEach(() => {
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useTheme', () => {
  it('always returns dark theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolved).toBe('dark');
  });

  it('adds dark class to document element', () => {
    renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme is a no-op (dark only)', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    result.current.setTheme('dark');
    expect(result.current.theme).toBe('dark');
  });

  it('throws when useTheme is used outside ThemeProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow();
    spy.mockRestore();
  });
});
