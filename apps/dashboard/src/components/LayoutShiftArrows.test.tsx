import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LayoutShiftArrows } from './LayoutShiftArrows';
import type { LayoutShiftArrowData } from './LayoutShiftArrows';

const makeShift = (overrides: Partial<LayoutShiftArrowData> = {}): LayoutShiftArrowData => ({
  baselineX: 10,
  baselineY: 10,
  baselineWidth: 50,
  baselineHeight: 50,
  currentX: 20,
  currentY: 20,
  currentWidth: 50,
  currentHeight: 50,
  magnitude: 15,
  selector: '.box',
  ...overrides,
});

describe('LayoutShiftArrows', () => {
  it('returns null when not visible', () => {
    const { container } = render(
      <LayoutShiftArrows shifts={[makeShift()]} imageWidth={100} imageHeight={100} visible={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null when shifts is empty', () => {
    const { container } = render(
      <LayoutShiftArrows shifts={[]} imageWidth={100} imageHeight={100} visible={true} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null when imageWidth is 0', () => {
    const { container } = render(
      <LayoutShiftArrows shifts={[makeShift()]} imageWidth={0} imageHeight={100} visible={true} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders SVG with arrows for valid shifts', () => {
    render(
      <LayoutShiftArrows shifts={[makeShift()]} imageWidth={100} imageHeight={100} visible={true} />,
    );
    expect(screen.getByTestId('layout-shift-arrows')).toBeInTheDocument();
  });

  it('uses red color for magnitude >= 20 (regression)', () => {
    render(
      <LayoutShiftArrows
        shifts={[makeShift({ magnitude: 25 })]}
        imageWidth={100}
        imageHeight={100}
        visible={true}
      />,
    );
    const svg = screen.getByTestId('layout-shift-arrows');
    const line = svg.querySelector('line');
    expect(line).toHaveAttribute('stroke', '#dc2626');
  });

  it('uses orange color for magnitude < 20', () => {
    render(
      <LayoutShiftArrows
        shifts={[makeShift({ magnitude: 10 })]}
        imageWidth={100}
        imageHeight={100}
        visible={true}
      />,
    );
    const svg = screen.getByTestId('layout-shift-arrows');
    const line = svg.querySelector('line');
    expect(line).toHaveAttribute('stroke', '#ea580c');
  });
});
