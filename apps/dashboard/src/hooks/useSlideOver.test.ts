import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { SlideOverProvider, useSlideOver } from './useSlideOver';

function wrapper({ children }: { children: ReactNode }) {
  return createElement(SlideOverProvider, null, children);
}

describe('useSlideOver', () => {
  it('starts closed with no content', () => {
    const { result } = renderHook(() => useSlideOver(), { wrapper });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.content).toBeNull();
    expect(result.current.title).toBe('');
  });

  it('opens with content and title', () => {
    const { result } = renderHook(() => useSlideOver(), { wrapper });
    const testContent = createElement('div', null, 'Test content');

    act(() => {
      result.current.open(testContent, { title: 'Test Panel' });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.content).not.toBeNull();
    expect(result.current.title).toBe('Test Panel');
  });

  it('closes and clears content', () => {
    const { result } = renderHook(() => useSlideOver(), { wrapper });
    const testContent = createElement('div', null, 'Test content');

    act(() => {
      result.current.open(testContent, { title: 'Test Panel' });
    });

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.content).toBeNull();
    expect(result.current.title).toBe('');
  });

  it('throws when used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSlideOver())).toThrow();
    spy.mockRestore();
  });
});
