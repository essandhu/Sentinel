import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SideBySide } from './SideBySide';

// Mock react-zoom-pan-pinch
vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({
    children,
    onTransformed,
  }: {
    children: React.ReactNode | ((...args: unknown[]) => React.ReactNode);
    onTransformed?: unknown;
  }) => {
    // Support render prop pattern
    if (typeof children === 'function') {
      return <div data-testid="transform-wrapper">{children({} as never)}</div>;
    }
    return <div data-testid="transform-wrapper">{children}</div>;
  },
  TransformComponent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="transform-component">{children}</div>
  ),
}));

describe('SideBySide', () => {
  const beforeUrl = 'http://example.com/before.png';
  const afterUrl = 'http://example.com/after.png';

  it('renders two images with correct src', () => {
    render(<SideBySide beforeUrl={beforeUrl} afterUrl={afterUrl} />);

    const images = screen.getAllByRole('img');
    const srcs = images.map((img) => img.getAttribute('src'));
    expect(srcs).toContain(beforeUrl);
    expect(srcs).toContain(afterUrl);
  });

  it('renders "Before" and "After" labels', () => {
    render(<SideBySide beforeUrl={beforeUrl} afterUrl={afterUrl} />);

    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
  });

  it('renders two TransformWrapper instances', () => {
    render(<SideBySide beforeUrl={beforeUrl} afterUrl={afterUrl} />);

    const wrappers = screen.getAllByTestId('transform-wrapper');
    expect(wrappers).toHaveLength(2);
  });

  it('renders before image with alt text', () => {
    render(<SideBySide beforeUrl={beforeUrl} afterUrl={afterUrl} />);

    expect(screen.getByAltText('Before')).toBeInTheDocument();
  });

  it('renders after image with alt text', () => {
    render(<SideBySide beforeUrl={beforeUrl} afterUrl={afterUrl} />);

    expect(screen.getByAltText('After')).toBeInTheDocument();
  });
});
