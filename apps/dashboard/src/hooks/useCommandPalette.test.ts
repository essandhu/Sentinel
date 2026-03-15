import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { CommandPaletteProvider, useCommandPalette } from './useCommandPalette';
import type { CommandAction } from './useCommandPalette';

function wrapper({ children }: { children: ReactNode }) {
  return createElement(CommandPaletteProvider, null, children);
}

describe('useCommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with palette closed', () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    expect(result.current.isOpen).toBe(false);
  });

  it('open() opens the palette', () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    act(() => { result.current.open(); });
    expect(result.current.isOpen).toBe(true);
  });

  it('close() closes the palette', () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    act(() => { result.current.open(); });
    act(() => { result.current.close(); });
    expect(result.current.isOpen).toBe(false);
  });

  it('toggle() toggles open/close state', () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    act(() => { result.current.toggle(); });
    expect(result.current.isOpen).toBe(true);
    act(() => { result.current.toggle(); });
    expect(result.current.isOpen).toBe(false);
  });

  it('registerAction adds an action to the actions map', () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    const action: CommandAction = {
      id: 'test-action',
      label: 'Test Action',
      section: 'Test',
      onExecute: vi.fn(),
    };

    act(() => { result.current.registerAction(action); });
    expect(result.current.actions.has('test-action')).toBe(true);
    expect(result.current.actions.get('test-action')?.label).toBe('Test Action');
  });

  it('unregisterAction removes an action from the map', () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    const action: CommandAction = {
      id: 'test-action',
      label: 'Test Action',
      section: 'Test',
      onExecute: vi.fn(),
    };

    act(() => { result.current.registerAction(action); });
    act(() => { result.current.unregisterAction('test-action'); });
    expect(result.current.actions.has('test-action')).toBe(false);
  });

  it('Cmd+K keydown toggles the palette', () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
      );
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
      );
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('Ctrl+K keydown toggles the palette', () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }),
      );
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('throws when used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useCommandPalette())).toThrow();
    spy.mockRestore();
  });
});
