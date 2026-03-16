import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncedCallback } from '../commands/watch.js';

describe('createDebouncedCallback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls callback after debounce delay', () => {
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 500);
    debounced();
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('resets timer on subsequent calls within debounce window', () => {
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 500);
    debounced();
    vi.advanceTimersByTime(300);
    debounced();
    vi.advanceTimersByTime(300);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('does not call callback if cancelled before delay', () => {
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 500);
    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('handles rapid flurry of calls with single callback', () => {
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 200);
    for (let i = 0; i < 10; i++) {
      debounced();
      vi.advanceTimersByTime(50);
    }
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('allows multiple separate invocations after debounce completes', () => {
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 200);
    debounced();
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(1);
    debounced();
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe('watchCommand', () => {
  it('exits with message when no watch config is present', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mock('@sentinel/capture', () => ({
      loadConfig: vi.fn().mockResolvedValue({
        project: 'test',
        baseUrl: 'http://localhost:3000',
        capture: { routes: [{ path: '/', name: 'home' }] },
        // no watch property
      }),
    }));

    const { watchCommand } = await import('../commands/watch.js');
    await watchCommand({});

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No watch.paths configured'),
    );
    consoleSpy.mockRestore();
  });
});
