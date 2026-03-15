import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

function fireKey(key: string, target?: EventTarget) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  if (target) {
    Object.defineProperty(event, 'target', { value: target });
  }
  document.dispatchEvent(event);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useKeyboardShortcuts', () => {
  it('calls handler when registered key is pressed', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ j: handler }));

    act(() => fireKey('j'));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does NOT call handler when focus is on an INPUT element', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ j: handler }));

    const input = document.createElement('input');
    document.body.appendChild(input);

    act(() => fireKey('j', input));

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('does NOT call handler when focus is on a TEXTAREA element', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ j: handler }));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    act(() => fireKey('j', textarea));

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('does nothing when an unregistered key is pressed', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ j: handler }));

    act(() => fireKey('x'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('disables all shortcuts when enabled=false', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ j: handler }, false));

    act(() => fireKey('j'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('cleans up event listener on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ j: handler }));

    unmount();

    act(() => fireKey('j'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple shortcuts simultaneously', () => {
    const jHandler = vi.fn();
    const kHandler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ j: jHandler, k: kHandler }));

    act(() => fireKey('j'));
    act(() => fireKey('k'));

    expect(jHandler).toHaveBeenCalledTimes(1);
    expect(kHandler).toHaveBeenCalledTimes(1);
  });

  it('supports Escape key', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ Escape: handler }));

    act(() => fireKey('Escape'));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does NOT call handler when focus is on a SELECT element', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ j: handler }));

    const select = document.createElement('select');
    document.body.appendChild(select);

    act(() => fireKey('j', select));

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(select);
  });

  it('does NOT call handler when focus is on a contentEditable element', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ j: handler }));

    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);

    act(() => fireKey('j', div));

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it('does NOT call handler when command palette is open', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ j: handler }));

    const palette = document.createElement('div');
    palette.setAttribute('data-command-palette', '');
    document.body.appendChild(palette);

    act(() => fireKey('j'));

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(palette);
  });
});
