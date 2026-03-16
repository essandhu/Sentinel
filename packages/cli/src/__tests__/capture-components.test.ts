import { describe, it, expect } from 'vitest';
import {
  componentsToAdapterConfig,
  filterStories,
  isStorybookRunning,
} from '../commands/capture-components.js';

describe('componentsToAdapterConfig', () => {
  it('converts shorthand to adapter format', () => {
    const result = componentsToAdapterConfig({
      source: 'storybook',
      url: 'http://localhost:9009',
    });
    expect(result).toEqual({
      type: 'storybook',
      storybookUrl: 'http://localhost:9009',
      storyIds: undefined,
    });
  });

  it('defaults url to localhost:6006', () => {
    const result = componentsToAdapterConfig({ source: 'storybook' });
    expect(result).toEqual({
      type: 'storybook',
      storybookUrl: 'http://localhost:6006',
      storyIds: undefined,
    });
  });
});

describe('filterStories', () => {
  const stories = [
    'Button/Primary',
    'Button/Secondary',
    'Card/Default',
    'Card/WithImage',
    'Badge/Deprecated-Old',
  ];

  it('returns all when no filters', () => {
    expect(filterStories(stories)).toEqual(stories);
  });

  it('filters by include patterns', () => {
    const result = filterStories(stories, ['Button/**']);
    expect(result).toEqual(['Button/Primary', 'Button/Secondary']);
  });

  it('filters by exclude patterns', () => {
    const result = filterStories(stories, undefined, ['**/*Deprecated*']);
    expect(result).toEqual([
      'Button/Primary',
      'Button/Secondary',
      'Card/Default',
      'Card/WithImage',
    ]);
  });

  it('applies both include and exclude', () => {
    const result = filterStories(stories, ['Button/**', 'Badge/**'], ['**/*Deprecated*']);
    expect(result).toEqual(['Button/Primary', 'Button/Secondary']);
  });
});

describe('isStorybookRunning', () => {
  it('returns false for unreachable URL', async () => {
    const result = await isStorybookRunning('http://127.0.0.1:19999');
    expect(result).toBe(false);
  });
});
