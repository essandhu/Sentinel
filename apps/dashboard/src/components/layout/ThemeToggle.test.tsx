import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('renders nothing (dark mode only)', () => {
    const { container } = render(<ThemeToggle />);
    expect(container.innerHTML).toBe('');
  });
});
