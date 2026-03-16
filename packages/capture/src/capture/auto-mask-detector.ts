import type { MaskRule } from '../config/config-schema.js';

export interface UnstableRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Divide diff image into grid cells, find connected components of cells
 * containing diff pixels, and return bounding boxes.
 */
export const identifyUnstableRegions = (
  diffData: Uint8ClampedArray,
  width: number,
  height: number,
  cellSize: number = 20,
): UnstableRegion[] => {
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const grid = new Uint8Array(rows * cols);

  // Mark cells containing diff pixels (non-zero red channel with non-zero alpha)
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = (py * width + px) * 4;
      const r = diffData[idx];
      const a = diffData[idx + 3];
      if (r > 0 && a > 0) {
        const cellRow = Math.floor(py / cellSize);
        const cellCol = Math.floor(px / cellSize);
        grid[cellRow * cols + cellCol] = 1;
      }
    }
  }

  // Flood-fill to find connected components
  const visited = new Uint8Array(rows * cols);
  const regions: UnstableRegion[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r * cols + c] === 0 || visited[r * cols + c] === 1) continue;

      // BFS flood fill
      let minRow = r;
      let maxRow = r;
      let minCol = c;
      let maxCol = c;
      const queue: Array<[number, number]> = [[r, c]];
      visited[r * cols + c] = 1;

      while (queue.length > 0) {
        const [cr, cc] = queue.shift()!;
        minRow = Math.min(minRow, cr);
        maxRow = Math.max(maxRow, cr);
        minCol = Math.min(minCol, cc);
        maxCol = Math.max(maxCol, cc);

        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (grid[nr * cols + nc] === 0 || visited[nr * cols + nc] === 1) continue;
          visited[nr * cols + nc] = 1;
          queue.push([nr, nc]);
        }
      }

      regions.push({
        x: minCol * cellSize,
        y: minRow * cellSize,
        width: (maxCol - minCol + 1) * cellSize,
        height: (maxRow - minRow + 1) * cellSize,
      });
    }
  }

  return regions;
};

/**
 * For each unstable region, find DOM elements whose bounding box overlaps.
 * Returns unique CSS selectors.
 */
export const selectorsForRegions = (
  regions: UnstableRegion[],
  domPositions: Array<{
    selector: string;
    tagName: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
): string[] => {
  const selectors = new Set<string>();

  for (const region of regions) {
    for (const el of domPositions) {
      if (rectsOverlap(region, el)) {
        selectors.add(el.selector);
      }
    }
  }

  return [...selectors];
};

const rectsOverlap = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

/**
 * Convert CSS selectors into MaskRule objects with 'hide' strategy.
 */
export const buildAutoMaskRules = (selectors: string[]): MaskRule[] =>
  selectors.map((selector) => ({ selector, strategy: 'hide' as const }));
