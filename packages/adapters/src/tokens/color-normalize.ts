import Color from 'colorjs.io';

/**
 * DTCG structured color value object (W3C Design Token Community Group format).
 * @see https://tr.designtokens.org/format/#color
 */
export interface DtcgColorValue {
  colorSpace: string;
  components: number[];
  alpha?: number;
}

/**
 * Normalizes any CSS Color 4 or DTCG structured color value to a lowercase
 * 6-digit sRGB hex string (e.g. "#0066cc").
 *
 * Supports:
 *  - Hex strings: "#0066CC" → "#0066cc"
 *  - rgb(): "rgb(0, 102, 204)" → "#0066cc"
 *  - hsl(): "hsl(210, 100%, 40%)" → "#0066cc"
 *  - oklch(): "oklch(44% 0.17 261)" → "#0066cc" (gamut-mapped to sRGB)
 *  - CSS named colors: "rebeccapurple" → "#663399"
 *  - DTCG structured objects: { colorSpace: "srgb", components: [0, 0.4, 0.8] } → "#0066cc"
 *
 * On invalid input, degrades gracefully:
 *  - Invalid string → returns the original string unchanged
 *  - Invalid object → returns JSON.stringify(input)
 *  - Never throws
 */
export function normalizeColorToHex(rawValue: string | DtcgColorValue | Record<string, unknown>): string {
  try {
    let color: Color;

    if (typeof rawValue === 'string') {
      color = new Color(rawValue);
    } else if (
      rawValue !== null &&
      typeof rawValue === 'object' &&
      'colorSpace' in rawValue &&
      'components' in rawValue
    ) {
      const dtcg = rawValue as DtcgColorValue;
      const coords = dtcg.components.slice(0, 3) as [number, number, number];
      color = new Color(dtcg.colorSpace, coords, dtcg.alpha ?? 1);
    } else {
      return JSON.stringify(rawValue);
    }

    const srgb = color.to('srgb');
    // Force 6-digit hex by manually formatting from sRGB channel values.
    // colorjs.io may produce 3-digit shorthand (#06c) or 8-digit with alpha (#ff000080).
    const r = Math.round(Math.min(1, Math.max(0, srgb.coords[0])) * 255);
    const g = Math.round(Math.min(1, Math.max(0, srgb.coords[1])) * 255);
    const b = Math.round(Math.min(1, Math.max(0, srgb.coords[2])) * 255);
    const hex = '#' +
      r.toString(16).padStart(2, '0') +
      g.toString(16).padStart(2, '0') +
      b.toString(16).padStart(2, '0');
    return hex;
  } catch {
    if (typeof rawValue === 'string') {
      return rawValue;
    }
    return JSON.stringify(rawValue);
  }
}
