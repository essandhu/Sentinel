import { describe, it, expect } from 'vitest';
import { parseRedisUrl } from './parse-redis-url.js';

describe('parseRedisUrl', () => {
  it('parses basic redis URL with host and port', () => {
    const result = parseRedisUrl('redis://localhost:6379');
    expect(result).toEqual({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
    });
  });

  it('defaults port to 6379 when not specified', () => {
    const result = parseRedisUrl('redis://myhost');
    expect(result.host).toBe('myhost');
    expect(result.port).toBe(6379);
  });

  it('parses password, host, port, and database number', () => {
    const result = parseRedisUrl('redis://:secret@host:6380/2');
    expect(result).toEqual({
      host: 'host',
      port: 6380,
      password: 'secret',
      db: 2,
      maxRetriesPerRequest: null,
    });
  });

  it('parses rediss:// (TLS) with username and password', () => {
    const result = parseRedisUrl('rediss://user:pass@host:6379');
    expect(result).toEqual({
      host: 'host',
      port: 6379,
      username: 'user',
      password: 'pass',
      tls: {},
      maxRetriesPerRequest: null,
    });
  });

  it('omits db when pathname is /0 or /', () => {
    const result0 = parseRedisUrl('redis://host/0');
    expect(result0.db).toBeUndefined();

    const resultSlash = parseRedisUrl('redis://host/');
    expect(resultSlash.db).toBeUndefined();
  });

  it('omits username and password when not provided', () => {
    const result = parseRedisUrl('redis://localhost:6379');
    expect(result.username).toBeUndefined();
    expect(result.password).toBeUndefined();
  });

  it('always sets maxRetriesPerRequest to null', () => {
    const result = parseRedisUrl('redis://localhost');
    expect(result.maxRetriesPerRequest).toBeNull();
  });

  it('handles URL-encoded password characters', () => {
    const result = parseRedisUrl('redis://:p%40ss%3Aword@host:6379');
    expect(result.password).toBe('p@ss:word');
  });
});
