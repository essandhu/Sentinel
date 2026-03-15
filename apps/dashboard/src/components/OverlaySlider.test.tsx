import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverlaySlider } from './OverlaySlider';

// Mock react-compare-slider
vi.mock('react-compare-slider', () => ({
  ReactCompareSlider: ({
    itemOne,
    itemTwo,
  }: {
    itemOne: React.ReactNode;
    itemTwo: React.ReactNode;
  }) => (
    <div data-testid="compare-slider">
      <div data-testid="item-one">{itemOne}</div>
      <div data-testid="item-two">{itemTwo}</div>
    </div>
  ),
  ReactCompareSliderImage: ({
    src,
    alt,
  }: {
    src: string;
    alt?: string;
  }) => <img src={src} alt={alt} />,
}));

describe('OverlaySlider', () => {
  const beforeUrl = 'http://example.com/before.png';
  const afterUrl = 'http://example.com/after.png';

  it('renders ReactCompareSlider', () => {
    render(<OverlaySlider beforeUrl={beforeUrl} afterUrl={afterUrl} />);

    expect(screen.getByTestId('compare-slider')).toBeInTheDocument();
  });

  it('renders before image with correct src in itemOne', () => {
    render(<OverlaySlider beforeUrl={beforeUrl} afterUrl={afterUrl} />);

    const itemOne = screen.getByTestId('item-one');
    const img = itemOne.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe(beforeUrl);
  });

  it('renders after image with correct src in itemTwo', () => {
    render(<OverlaySlider beforeUrl={beforeUrl} afterUrl={afterUrl} />);

    const itemTwo = screen.getByTestId('item-two');
    const img = itemTwo.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe(afterUrl);
  });

  it('renders images with alt text', () => {
    render(<OverlaySlider beforeUrl={beforeUrl} afterUrl={afterUrl} />);

    expect(screen.getByAltText('Before')).toBeInTheDocument();
    expect(screen.getByAltText('After')).toBeInTheDocument();
  });
});
