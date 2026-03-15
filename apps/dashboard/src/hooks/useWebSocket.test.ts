import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from './useWebSocket';

// Mock @clerk/react
const mockGetToken = vi.fn<() => Promise<string | null>>();
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  readyState = 0; // CONNECTING
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  // Helpers for tests
  simulateOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.(new Event('open'));
  }

  simulateClose() {
    this.readyState = 3; // CLOSED
    this.onclose?.({ code: 1000, reason: '' } as CloseEvent);
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

// Assign mock to global
const OriginalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  MockWebSocket.instances = [];
  (globalThis as any).WebSocket = MockWebSocket as any;
  mockGetToken.mockResolvedValue('test-token');
});

afterEach(() => {
  globalThis.WebSocket = OriginalWebSocket;
  vi.restoreAllMocks();
});

describe('useWebSocket', () => {
  it('connects with correct URL including auth token', async () => {
    const onEvent = vi.fn();
    renderHook(() => useWebSocket(onEvent));

    // Wait for async getToken
    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const ws = MockWebSocket.instances[0]!;
    expect(ws.url).toContain('/ws?token=test-token');
    expect(ws.url).toMatch(/^wss?:\/\//);
  });

  it('calls onEvent with parsed JSON on message', async () => {
    const onEvent = vi.fn();
    renderHook(() => useWebSocket(onEvent));

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({ type: 'capture:progress', payload: { jobId: '1' } }));

    expect(onEvent).toHaveBeenCalledWith({ type: 'capture:progress', payload: { jobId: '1' } });
  });

  it('silently ignores malformed (non-JSON) messages', async () => {
    const onEvent = vi.fn();
    renderHook(() => useWebSocket(onEvent));

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();

    // Should not throw
    expect(() => ws.simulateMessage('not valid json {')).not.toThrow();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('reconnects with exponential backoff on close', async () => {
    vi.useFakeTimers();
    const onEvent = vi.fn();
    renderHook(() => useWebSocket(onEvent));

    // Wait for initial connection
    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const ws1 = MockWebSocket.instances[0]!;
    ws1.simulateOpen();
    ws1.simulateClose();

    // After 1s delay, should create new WebSocket
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    // Need to wait for the async getToken in reconnect
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(MockWebSocket.instances).toHaveLength(2);

    // Second close: 2s delay
    MockWebSocket.instances[1]!.simulateClose();
    await act(async () => {
      vi.advanceTimersByTime(1999);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(MockWebSocket.instances).toHaveLength(2); // Not yet

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(MockWebSocket.instances).toHaveLength(3);

    vi.useRealTimers();
  });

  it('caps reconnection delay at 30 seconds', async () => {
    vi.useFakeTimers();
    const onEvent = vi.fn();
    renderHook(() => useWebSocket(onEvent));

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    // Simulate many disconnects to reach cap: 1, 2, 4, 8, 16, 30, 30...
    const ws1 = MockWebSocket.instances[0]!;
    ws1.simulateOpen();

    // Close 6 times to get to 30s cap (delays: 1, 2, 4, 8, 16, 30)
    for (let i = 0; i < 5; i++) {
      const current = MockWebSocket.instances[MockWebSocket.instances.length - 1]!;
      current.simulateClose();
      const delay = Math.min(1000 * 2 ** i, 30000);
      await act(async () => {
        vi.advanceTimersByTime(delay);
        await vi.advanceTimersByTimeAsync(0);
      });
    }

    // Now retries = 5, delay should be min(32000, 30000) = 30000
    const currentWs = MockWebSocket.instances[MockWebSocket.instances.length - 1]!;
    currentWs.simulateClose();

    await act(async () => {
      vi.advanceTimersByTime(29999);
      await vi.advanceTimersByTimeAsync(0);
    });
    const countBefore = MockWebSocket.instances.length;

    await act(async () => {
      vi.advanceTimersByTime(1);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(MockWebSocket.instances.length).toBe(countBefore + 1);

    vi.useRealTimers();
  });

  it('resets retry counter on successful connection', async () => {
    vi.useFakeTimers();
    const onEvent = vi.fn();
    renderHook(() => useWebSocket(onEvent));

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    // Connect, close (retry=0 -> delay 1s), reconnect
    const ws1 = MockWebSocket.instances[0]!;
    ws1.simulateOpen();
    ws1.simulateClose();

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(MockWebSocket.instances).toHaveLength(2);

    // Close again (retry=1 -> delay 2s), reconnect
    MockWebSocket.instances[1]!.simulateClose();
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(MockWebSocket.instances).toHaveLength(3);

    // Now open successfully -> should reset retries
    MockWebSocket.instances[2]!.simulateOpen();

    // Close again -> delay should be 1s again (reset!)
    MockWebSocket.instances[2]!.simulateClose();
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(MockWebSocket.instances).toHaveLength(4); // Would be 3 if not reset (would need 4s)

    vi.useRealTimers();
  });

  it('closes WebSocket and clears timeout on unmount', async () => {
    vi.useFakeTimers();
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useWebSocket(onEvent));

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();

    // Trigger a pending reconnect
    ws.simulateClose();

    // Unmount before reconnect fires
    unmount();

    // The existing socket should have been closed
    expect(ws.close).toHaveBeenCalled();

    // Advance past reconnect delay - should NOT create new socket
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(MockWebSocket.instances).toHaveLength(1);

    vi.useRealTimers();
  });

  it('does not create WebSocket when token is null (unauthenticated)', async () => {
    mockGetToken.mockResolvedValue(null);
    const onEvent = vi.fn();
    renderHook(() => useWebSocket(onEvent));

    // Give time for the async getToken to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(MockWebSocket.instances).toHaveLength(0);
  });
});
