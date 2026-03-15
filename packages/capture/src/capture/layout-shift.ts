import type { ElementPosition } from './dom-positions.js';

export interface LayoutShift {
  selector: string;
  tagName: string;
  baselineX: number;
  baselineY: number;
  baselineWidth: number;
  baselineHeight: number;
  currentX: number;
  currentY: number;
  currentWidth: number;
  currentHeight: number;
  displacementX: number;
  displacementY: number;
  magnitude: number; // pixels, integer
}

export interface LayoutShiftResult {
  shifts: LayoutShift[];
  maxMagnitude: number;
  regressions: LayoutShift[]; // shifts exceeding regressionThreshold
}

export function computeLayoutShifts(
  baselinePositions: ElementPosition[],
  currentPositions: ElementPosition[],
  minMagnitude: number = 5,
): LayoutShift[] {
  const baseMap = new Map(baselinePositions.map((p) => [p.selector, p]));
  const shifts: LayoutShift[] = [];

  for (const current of currentPositions) {
    const baseline = baseMap.get(current.selector);
    if (!baseline) continue;

    const dx = current.x - baseline.x;
    const dy = current.y - baseline.y;
    const magnitude = Math.round(Math.sqrt(dx * dx + dy * dy));

    if (magnitude >= minMagnitude) {
      shifts.push({
        selector: current.selector,
        tagName: current.tagName,
        baselineX: baseline.x,
        baselineY: baseline.y,
        baselineWidth: baseline.width,
        baselineHeight: baseline.height,
        currentX: current.x,
        currentY: current.y,
        currentWidth: current.width,
        currentHeight: current.height,
        displacementX: dx,
        displacementY: dy,
        magnitude,
      });
    }
  }

  return shifts;
}

export function scoreLayoutShifts(
  shifts: LayoutShift[],
  regressionThreshold: number = 20,
): LayoutShiftResult {
  const regressions = shifts.filter((s) => s.magnitude >= regressionThreshold);
  const maxMagnitude =
    shifts.length > 0 ? Math.max(...shifts.map((s) => s.magnitude)) : 0;

  return { shifts, maxMagnitude, regressions };
}
