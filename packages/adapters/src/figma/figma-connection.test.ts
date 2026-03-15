import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerFigmaWebhook, deleteFigmaWebhook } from './figma-connection.js';

describe('registerFigmaWebhook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct POST payload and returns webhook id and status', async () => {
    const mockResponse = { id: 'wh-123', status: 'ACTIVE' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await registerFigmaWebhook(
      'tok-abc',
      'file-key-xyz',
      'https://sentinel.example.com/webhooks/figma',
      'my-passcode',
    );

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.figma.com/v2/webhooks');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-Figma-Token']).toBe('tok-abc');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string);
    expect(body.event_type).toBe('LIBRARY_PUBLISH');
    expect(body.context).toBe('file');
    expect(body.context_id).toBe('file-key-xyz');
    expect(body.endpoint).toBe('https://sentinel.example.com/webhooks/figma');
    expect(body.passcode).toBe('my-passcode');
    expect(body.description).toContain('file-key-xyz');

    expect(result).toEqual({ id: 'wh-123', status: 'ACTIVE' });
  });

  it('throws on non-OK response with status and body in error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":"Invalid token"}', { status: 400 }),
    );

    await expect(
      registerFigmaWebhook('bad-tok', 'file-key', 'https://example.com/hook', 'pass'),
    ).rejects.toThrow(/400/);

    await vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":"Invalid token"}', { status: 400 }),
    );

    await expect(
      registerFigmaWebhook('bad-tok', 'file-key', 'https://example.com/hook', 'pass'),
    ).rejects.toThrow(/Invalid token/);
  });
});

describe('deleteFigmaWebhook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls DELETE with correct URL and header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    await deleteFigmaWebhook('tok-abc', 'wh-456');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.figma.com/v2/webhooks/wh-456');
    expect(init.method).toBe('DELETE');
    expect((init.headers as Record<string, string>)['X-Figma-Token']).toBe('tok-abc');
  });

  it('throws on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not found', { status: 404 }),
    );

    await expect(deleteFigmaWebhook('tok-abc', 'wh-missing')).rejects.toThrow(/404/);
  });
});
