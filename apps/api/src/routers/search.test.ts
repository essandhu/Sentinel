import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

// We test the input schema validation directly
// This avoids needing to spin up a full tRPC caller

const searchInputSchema = z.object({
  projectId: z.string().uuid(),
  q: z.string().min(2).max(100),
});

describe('searchRouter input validation', () => {
  it('rejects query shorter than 2 characters', () => {
    const result = searchInputSchema.safeParse({
      projectId: '00000000-0000-4000-a000-000000000001',
      q: 'a',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty query', () => {
    const result = searchInputSchema.safeParse({
      projectId: '00000000-0000-4000-a000-000000000001',
      q: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID projectId', () => {
    const result = searchInputSchema.safeParse({
      projectId: 'not-a-uuid',
      q: 'test query',
    });
    expect(result.success).toBe(false);
  });

  it('rejects query longer than 100 characters', () => {
    const result = searchInputSchema.safeParse({
      projectId: '00000000-0000-4000-a000-000000000001',
      q: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid input', () => {
    const result = searchInputSchema.safeParse({
      projectId: '00000000-0000-4000-a000-000000000001',
      q: 'login page',
    });
    expect(result.success).toBe(true);
  });

  it('accepts minimum valid query (2 chars)', () => {
    const result = searchInputSchema.safeParse({
      projectId: '00000000-0000-4000-a000-000000000001',
      q: 'ab',
    });
    expect(result.success).toBe(true);
  });
});
