import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RegionOverlay, type Region } from './RegionOverlay';

const sampleRegions: Region[] = [
  { relX: 1000, relY: 2000, relWidth: 3000, relHeight: 1500, regionCategory: 'layout' },
  { relX: 5000, relY: 500, relWidth: 2000, relHeight: 1000, regionCategory: 'style' },
];

function renderOverlay(
  regions: Region[] = sampleRegions,
  visible = true,
  onRegionClick?: (region: Region, index: number) => void,
) {
  return render(
    <div style={{ position: 'relative', width: 800, height: 600 }}>
      <RegionOverlay regions={regions} visible={visible} onRegionClick={onRegionClick} />
    </div>,
  );
}

describe('RegionOverlay', () => {
  it('renders nothing when visible is false', () => {
    renderOverlay(sampleRegions, false);
    expect(screen.queryAllByTestId('region-box')).toHaveLength(0);
  });

  it('renders correct number of region boxes when visible', () => {
    renderOverlay();
    expect(screen.getAllByTestId('region-box')).toHaveLength(2);
  });

  it('applies correct percentage positioning from relative coords', () => {
    renderOverlay();
    const boxes = screen.getAllByTestId('region-box');
    // First region: relX=1000 -> 10%, relY=2000 -> 20%, relWidth=3000 -> 30%, relHeight=1500 -> 15%
    expect(boxes[0].style.left).toBe('10%');
    expect(boxes[0].style.top).toBe('20%');
    expect(boxes[0].style.width).toBe('30%');
    expect(boxes[0].style.height).toBe('15%');
  });

  it('applies category-based border colors', () => {
    renderOverlay();
    const boxes = screen.getAllByTestId('region-box');
    expect(boxes[0].className).toContain('border-purple-500');
    expect(boxes[1].className).toContain('border-blue-500');
  });

  it('renders category labels on region boxes', () => {
    renderOverlay();
    expect(screen.getByText('layout')).toBeInTheDocument();
    expect(screen.getByText('style')).toBeInTheDocument();
  });

  it('does not render label when regionCategory is not set', () => {
    const noCategory: Region[] = [
      { relX: 100, relY: 200, relWidth: 300, relHeight: 400 },
    ];
    renderOverlay(noCategory);
    const boxes = screen.getAllByTestId('region-box');
    expect(boxes).toHaveLength(1);
    // No label text inside the box
    expect(boxes[0].querySelector('span')).toBeNull();
  });

  it('calls onRegionClick with region and index when clicked', () => {
    const onClick = vi.fn();
    renderOverlay(sampleRegions, true, onClick);
    const boxes = screen.getAllByTestId('region-box');
    fireEvent.click(boxes[1]);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick).toHaveBeenCalledWith(sampleRegions[1], 1);
  });

  it('renders confidence percentage when regionConfidence is provided', () => {
    const withConfidence: Region[] = [
      { relX: 1000, relY: 2000, relWidth: 3000, relHeight: 1500, regionCategory: 'layout', regionConfidence: 85 },
    ];
    renderOverlay(withConfidence);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('renders category label without confidence when regionConfidence is not set', () => {
    renderOverlay();
    // 'layout' label should render without any percentage
    expect(screen.getByText('layout')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('boxes are pointer-events-none when no onRegionClick provided', () => {
    renderOverlay();
    const boxes = screen.getAllByTestId('region-box');
    expect(boxes[0].className).toContain('pointer-events-none');
  });

  it('boxes are pointer-events-auto when onRegionClick provided', () => {
    const onClick = vi.fn();
    renderOverlay(sampleRegions, true, onClick);
    const boxes = screen.getAllByTestId('region-box');
    expect(boxes[0].className).toContain('pointer-events-auto');
    expect(boxes[0].className).toContain('cursor-pointer');
  });

  it('renders spatialZone as title attribute for tooltip', () => {
    const withZone: Region[] = [
      { relX: 1000, relY: 2000, relWidth: 3000, relHeight: 1500, regionCategory: 'layout', spatialZone: 'header' },
    ];
    renderOverlay(withZone);
    const boxes = screen.getAllByTestId('region-box');
    expect(boxes[0].getAttribute('title')).toBe('Zone: header');
  });
});
