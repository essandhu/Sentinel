import { describe, it, expect } from 'vitest';
import { CREDENTIALS_PATH, SENTINEL_DIR } from './login.js';

describe('credentials', () => {
  it('exports CREDENTIALS_PATH pointing to ~/.sentinel/config.json', () => {
    expect(CREDENTIALS_PATH).toContain('.sentinel');
    expect(CREDENTIALS_PATH).toContain('config.json');
  });

  it('SENTINEL_DIR contains .sentinel', () => {
    expect(SENTINEL_DIR).toContain('.sentinel');
  });
});
