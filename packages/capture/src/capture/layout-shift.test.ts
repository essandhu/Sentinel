import { describe, it, expect } from 'vitest';
import { computeLayoutShifts, scoreLayoutShifts } from './layout-shift.js';
import type { ElementPosition } from './dom-positions.js';

function pos(
  selector: string,
  tagName: string,
  x: number,
  y: number,
  width: number,
  height: number,
): ElementPosition {
  return { selector, tagName, x, y, width, height };
}

describe('computeLayoutShifts', () => {
  it('returns displacement vectors for matching elements (dx=3, dy=4 -> magnitude=5)', () => {
    const baseline = [pos('#header', 'header', 0, 0, 1024, 60)];
    const current = [pos('#header', 'header', 3, 4, 1024, 60)];
    const shifts = computeLayoutShifts(baseline, current);
    expect(shifts).toHaveLength(1);
    expect(shifts[0].displacementX).toBe(3);
    expect(shifts[0].displacementY).toBe(4);
    expect(shifts[0].magnitude).toBe(5); // sqrt(9+16) = 5
  });

  it('filters out shifts below default minMagnitude of 5px (dx=1, dy=1 -> magnitude~1)', () => {
    const baseline = [pos('#nav', 'nav', 0, 60, 1024, 40)];
    const current = [pos('#nav', 'nav', 1, 61, 1024, 40)]; // dx=1, dy=1, magnitude~1
    const shifts = computeLayoutShifts(baseline, current);
    expect(shifts).toHaveLength(0);
  });

  it('ignores elements only in baseline (removed element)', () => {
    const baseline = [
      pos('#header', 'header', 0, 0, 1024, 60),
      pos('#removed', 'div', 0, 100, 200, 50),
    ];
    const current = [pos('#header', 'header', 10, 0, 1024, 60)];
    const shifts = computeLayoutShifts(baseline, current);
    expect(shifts).toHaveLength(1);
    expect(shifts[0].selector).toBe('#header');
  });

  it('ignores elements only in current (added element)', () => {
    const baseline = [pos('#header', 'header', 0, 0, 1024, 60)];
    const current = [
      pos('#header', 'header', 10, 0, 1024, 60),
      pos('#new-el', 'div', 0, 200, 300, 100),
    ];
    const shifts = computeLayoutShifts(baseline, current);
    expect(shifts).toHaveLength(1);
    expect(shifts[0].selector).toBe('#header');
  });

  it('returns empty shifts array for empty baseline', () => {
    const current = [pos('#header', 'header', 0, 0, 1024, 60)];
    const shifts = computeLayoutShifts([], current);
    expect(shifts).toEqual([]);
  });

  it('includes baseline and current positions in shift record', () => {
    const baseline = [pos('#box', 'div', 10, 20, 100, 50)];
    const current = [pos('#box', 'div', 20, 30, 110, 55)];
    const shifts = computeLayoutShifts(baseline, current);
    expect(shifts).toHaveLength(1);
    expect(shifts[0].baselineX).toBe(10);
    expect(shifts[0].baselineY).toBe(20);
    expect(shifts[0].baselineWidth).toBe(100);
    expect(shifts[0].baselineHeight).toBe(50);
    expect(shifts[0].currentX).toBe(20);
    expect(shifts[0].currentY).toBe(30);
    expect(shifts[0].currentWidth).toBe(110);
    expect(shifts[0].currentHeight).toBe(55);
  });

  it('respects custom minMagnitude parameter', () => {
    const baseline = [pos('#el', 'div', 0, 0, 100, 50)];
    const current = [pos('#el', 'div', 3, 4, 100, 50)]; // magnitude=5
    expect(computeLayoutShifts(baseline, current, 6)).toHaveLength(0);
    expect(computeLayoutShifts(baseline, current, 5)).toHaveLength(1);
  });
});

describe('scoreLayoutShifts', () => {
  it('flags shifts >= regressionThreshold as regressions', () => {
    const baseline = [pos('#big', 'div', 0, 0, 100, 50)];
    const current = [pos('#big', 'div', 15, 20, 100, 50)]; // magnitude=25 (sqrt(225+400))
    const shifts = computeLayoutShifts(baseline, current);
    const result = scoreLayoutShifts(shifts, 20);
    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0].magnitude).toBe(25);
  });

  it('does not flag shifts below regressionThreshold', () => {
    const baseline = [pos('#small', 'div', 0, 0, 100, 50)];
    const current = [pos('#small', 'div', 10, 10, 100, 50)]; // magnitude~14
    const shifts = computeLayoutShifts(baseline, current);
    const result = scoreLayoutShifts(shifts, 20);
    expect(result.regressions).toHaveLength(0);
  });

  it('maxMagnitude is the highest magnitude in the result', () => {
    const baseline = [
      pos('#a', 'div', 0, 0, 100, 50),
      pos('#b', 'div', 0, 0, 100, 50),
    ];
    const current = [
      pos('#a', 'div', 10, 0, 100, 50), // magnitude=10
      pos('#b', 'div', 15, 20, 100, 50), // magnitude=25 (sqrt(225+400))
    ];
    const shifts = computeLayoutShifts(baseline, current);
    const result = scoreLayoutShifts(shifts);
    expect(result.maxMagnitude).toBe(25);
  });

  it('returns maxMagnitude 0 for empty shifts', () => {
    const result = scoreLayoutShifts([]);
    expect(result.maxMagnitude).toBe(0);
    expect(result.regressions).toEqual([]);
    expect(result.shifts).toEqual([]);
  });
});
