export interface Region {
  id: number;
  pixels: Array<{ x: number; y: number }>;
  boundingBox: { x: number; y: number; width: number; height: number };
  pixelCount: number;
}

/**
 * Detect connected change regions in a diff image using BFS flood-fill.
 *
 * Operates on raw RGBA pixel data from pixelmatch, where changed pixels
 * have a non-zero red channel (R > 0).
 *
 * Uses 4-connectivity (up/down/left/right neighbors).
 *
 * @param diffData - Raw RGBA pixel data (Uint8ClampedArray from pixelmatch)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param minPixels - Minimum pixel count to include a region (default 10, filters noise)
 * @returns Array of detected regions with bounding boxes
 */
export function findConnectedComponents(
  diffData: Uint8ClampedArray,
  width: number,
  height: number,
  minPixels: number = 10,
): Region[] {
  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const regions: Region[] = [];
  let regionId = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] || !isChangedPixel(diffData, idx)) continue;

      // BFS flood fill using array with index pointer (avoids shift() overhead)
      const queue: Array<number> = [idx];
      let queueHead = 0;
      const pixels: Array<{ x: number; y: number }> = [];
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      visited[idx] = 1;

      while (queueHead < queue.length) {
        const ci = queue[queueHead++];
        const cx = ci % width;
        const cy = (ci - cx) / width;

        pixels.push({ x: cx, y: cy });
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        // 4-connectivity neighbors: left, right, up, down
        const neighbors = [
          cx > 0 ? ci - 1 : -1,
          cx < width - 1 ? ci + 1 : -1,
          cy > 0 ? ci - width : -1,
          cy < height - 1 ? ci + width : -1,
        ];

        for (const ni of neighbors) {
          if (ni >= 0 && !visited[ni] && isChangedPixel(diffData, ni)) {
            visited[ni] = 1;
            queue.push(ni);
          }
        }
      }

      if (pixels.length >= minPixels) {
        regions.push({
          id: regionId++,
          pixels,
          boundingBox: {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
          },
          pixelCount: pixels.length,
        });
      }
    }
  }

  return regions;
}

/**
 * Check if a pixel is a changed pixel in the diff data.
 * pixelmatch outputs red pixels (R=255, G=0, B=0) for diffs by default.
 */
function isChangedPixel(data: Uint8ClampedArray, pixelIndex: number): boolean {
  const offset = pixelIndex * 4;
  return data[offset] > 0; // Red channel > 0 means changed
}
