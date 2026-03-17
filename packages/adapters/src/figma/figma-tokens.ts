import type { TokenValue } from '@sentinel-vrt/types';

const FIGMA_API_BASE = 'https://api.figma.com';

/**
 * Error class for Figma API errors with HTTP status code.
 */
export class FigmaApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'FigmaApiError';
    this.status = status;
  }
}

/**
 * Converts RGBA float values (0-1 range) to a hex color string (#RRGGBB).
 */
export function rgbaToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

interface VariablesResponse {
  meta: {
    variableCollections: Record<
      string,
      {
        id: string;
        name: string;
        defaultModeId: string;
        modes: Array<{ modeId: string; name: string }>;
      }
    >;
    variables: Record<
      string,
      {
        id: string;
        name: string;
        resolvedType: string;
        variableCollectionId: string;
        valuesByMode: Record<string, unknown>;
      }
    >;
  };
}

interface StylesMap {
  [nodeId: string]: {
    key: string;
    name: string;
    styleType: string;
  };
}

interface NodeData {
  document: {
    fills?: Array<{
      type: string;
      color: { r: number; g: number; b: number; a: number };
    }>;
    style?: {
      fontFamily?: string;
      fontSize?: number;
    };
  };
}

/**
 * Fetches design variables from the Figma Variables API (Enterprise only).
 * Throws FigmaApiError on non-OK responses.
 */
async function fetchVariables(
  fileKey: string,
  accessToken: string,
): Promise<VariablesResponse> {
  const response = await fetch(
    `${FIGMA_API_BASE}/v1/files/${fileKey}/variables/local`,
    {
      headers: { 'X-Figma-Token': accessToken },
    },
  );

  if (!response.ok) {
    throw new FigmaApiError(
      `Figma Variables API error: ${response.status}`,
      response.status,
    );
  }

  return response.json() as Promise<VariablesResponse>;
}

/**
 * Maps Variables API response data to design tokens.
 */
function mapVariablesToTokens(
  data: VariablesResponse,
): Record<string, TokenValue> {
  const tokens: Record<string, TokenValue> = {};
  const { variableCollections, variables } = data.meta;

  for (const variable of Object.values(variables)) {
    const collection = variableCollections[variable.variableCollectionId];
    if (!collection) continue;

    const defaultModeId = collection.defaultModeId;
    const value = variable.valuesByMode[defaultModeId];
    if (value === undefined) continue;

    if (
      variable.resolvedType === 'COLOR' &&
      typeof value === 'object' &&
      value !== null
    ) {
      const color = value as { r: number; g: number; b: number; a: number };
      tokens[variable.name] = {
        type: 'color',
        value: rgbaToHex(color.r, color.g, color.b),
      };
    } else if (
      variable.resolvedType === 'FLOAT' &&
      typeof value === 'number'
    ) {
      tokens[variable.name] = { type: 'number', value };
    }
  }

  return tokens;
}

/**
 * Fetches file styles metadata from Figma (node_ids -> style info).
 */
async function getFileStyles(
  fileKey: string,
  accessToken: string,
): Promise<StylesMap> {
  const response = await fetch(`${FIGMA_API_BASE}/v1/files/${fileKey}`, {
    headers: { 'X-Figma-Token': accessToken },
  });

  if (!response.ok) {
    throw new FigmaApiError(
      `Figma file API error: ${response.status}`,
      response.status,
    );
  }

  const data = (await response.json()) as { styles: StylesMap };
  return data.styles ?? {};
}

/**
 * Fetches node details for the given node IDs from Figma.
 */
async function getStyleNodes(
  fileKey: string,
  nodeIds: string[],
  accessToken: string,
): Promise<Record<string, NodeData>> {
  const ids = nodeIds.join(',');
  const response = await fetch(
    `${FIGMA_API_BASE}/v1/files/${fileKey}/nodes?ids=${ids}`,
    {
      headers: { 'X-Figma-Token': accessToken },
    },
  );

  if (!response.ok) {
    throw new FigmaApiError(
      `Figma nodes API error: ${response.status}`,
      response.status,
    );
  }

  const data = (await response.json()) as {
    nodes: Record<string, NodeData>;
  };
  return data.nodes;
}

/**
 * Extracts token values from Figma style nodes.
 * FILL styles -> color tokens, TEXT styles -> font-family + font-size tokens.
 */
function extractTokensFromStyles(
  stylesMap: StylesMap,
  nodesData: Record<string, NodeData>,
): Record<string, TokenValue> {
  const tokens: Record<string, TokenValue> = {};

  for (const [nodeId, styleInfo] of Object.entries(stylesMap)) {
    const node = nodesData[nodeId];
    if (!node?.document) continue;

    if (styleInfo.styleType === 'FILL') {
      const fills = node.document.fills;
      if (fills && fills.length > 0) {
        const solidFill = fills.find((f) => f.type === 'SOLID');
        if (solidFill?.color) {
          tokens[styleInfo.name] = {
            type: 'color',
            value: rgbaToHex(
              solidFill.color.r,
              solidFill.color.g,
              solidFill.color.b,
            ),
          };
        }
      }
    } else if (styleInfo.styleType === 'TEXT') {
      const style = node.document.style;
      if (style?.fontFamily) {
        tokens[`${styleInfo.name}/font-family`] = {
          type: 'font-family',
          value: style.fontFamily,
        };
      }
      if (style?.fontSize !== undefined) {
        tokens[`${styleInfo.name}/font-size`] = {
          type: 'font-size',
          value: style.fontSize,
        };
      }
    }
    // EFFECT and GRID types are skipped (not needed for v1.1)
  }

  return tokens;
}

/**
 * Extracts design tokens from a Figma file.
 *
 * Strategy:
 * 1. Try the Variables API first (Enterprise-only, returns rich variable data)
 * 2. On 403/404, fall back to two-step styles extraction:
 *    a. Get file styles metadata (node_ids)
 *    b. Fetch node details for those IDs
 *    c. Extract color/text tokens from node properties
 * 3. Re-throw any other errors
 */
export async function extractDesignTokens(
  fileKey: string,
  accessToken: string,
): Promise<Record<string, TokenValue>> {
  try {
    const variablesData = await fetchVariables(fileKey, accessToken);
    return mapVariablesToTokens(variablesData);
  } catch (err) {
    if (err instanceof FigmaApiError && (err.status === 403 || err.status === 404)) {
      // Fall back to styles extraction
      const stylesMap = await getFileStyles(fileKey, accessToken);

      const nodeIds = Object.keys(stylesMap);
      if (nodeIds.length === 0) {
        return {};
      }

      const nodesData = await getStyleNodes(fileKey, nodeIds, accessToken);
      return extractTokensFromStyles(stylesMap, nodesData);
    }

    throw err;
  }
}
