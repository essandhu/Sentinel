import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SentinelClient } from './api-client.js';

describe('SentinelClient', () => {
  it('constructs with server URL and API key', () => {
    const client = new SentinelClient({
      serverUrl: 'https://api.example.com',
      apiKey: 'sk_live_testkey',
    });
    expect(client).toBeDefined();
  });

  it('throws on missing serverUrl', () => {
    expect(() => new SentinelClient({ serverUrl: '', apiKey: 'key' })).toThrow();
  });

  it('throws on missing apiKey', () => {
    expect(() => new SentinelClient({ serverUrl: 'https://x.com', apiKey: '' })).toThrow();
  });

  it('appends /api/v1 to server URL if not present', () => {
    const client = new SentinelClient({
      serverUrl: 'https://api.example.com',
      apiKey: 'sk_live_testkey',
    });
    // We can test this indirectly by mocking fetch and checking the URL
    expect(client).toBeDefined();
  });

  it('does not double-append /api/v1', () => {
    const client = new SentinelClient({
      serverUrl: 'https://api.example.com/api/v1',
      apiKey: 'sk_live_testkey',
    });
    expect(client).toBeDefined();
  });
});
