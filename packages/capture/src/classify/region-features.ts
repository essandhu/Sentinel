import type { Region } from './connected-components.js';

export interface RegionFeatures {
  /** Relative X position (0-1) within image */
  relativeX: number;
  /** Relative Y position (0-1) within image */
  relativeY: number;
  /** Relative width (0-1) as fraction of image width */
  relativeWidth: number;
  /** Relative height (0-1) as fraction of image height */
  relativeHeight: number;
  /** Width/height ratio of bounding box */
  aspectRatio: number;
  /** Pixel count / bounding box area -- how solid the region is */
  density: number;
  /** Whether the region touches an image edge */
  isEdgeAligned: boolean;
  /** Fraction of image height covered by the region */
  verticalSpan: number;
  /** Fraction of image width covered by the region */
  horizontalSpan: number;
}

export type SpatialZone = 'header' | 'sidebar' | 'content' | 'footer' | 'full-width';

/**
 * Derive the spatial zone of a region based on its relative position and size.
 *
 * @param relX - Relative X center position (0-1)
 * @param relY - Relative Y position (0-1)
 * @param relWidth - Relative width (0-1)
 * @param relHeight - Relative height (0-1)
 */
export function deriveSpatialZone(
  relX: number,
  relY: number,
  relWidth: number,
  relHeight: number,
): SpatialZone {
  // Full-width: covers most of the image
  if (relWidth > 0.8 && relHeight > 0.5) return 'full-width';

  // Header: top 15% of image, wide
  if (relY < 0.15 && relWidth > 0.5) return 'header';

  // Footer: bottom 15% of image, wide
  if (relY + relHeight > 0.85 && relWidth > 0.5) return 'footer';

  // Sidebar: left edge, narrow
  if (relX < 0.05 && relWidth < 0.25) return 'sidebar';

  return 'content';
}

/**
 * Extract spatial features from a detected region for classification.
 */
export function extractFeatures(
  region: Region,
  imageWidth: number,
  imageHeight: number,
): RegionFeatures {
  const bb = region.boundingBox;
  const bbArea = bb.width * bb.height;

  return {
    relativeX: bb.x / imageWidth,
    relativeY: bb.y / imageHeight,
    relativeWidth: bb.width / imageWidth,
    relativeHeight: bb.height / imageHeight,
    aspectRatio: bb.height > 0 ? bb.width / bb.height : 1,
    density: bbArea > 0 ? region.pixelCount / bbArea : 0,
    isEdgeAligned:
      bb.x === 0 ||
      bb.y === 0 ||
      bb.x + bb.width >= imageWidth - 2 ||
      bb.y + bb.height >= imageHeight - 2,
    verticalSpan: bb.height / imageHeight,
    horizontalSpan: bb.width / imageWidth,
  };
}
