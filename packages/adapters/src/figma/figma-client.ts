const FIGMA_API_BASE = 'https://api.figma.com';

export interface FigmaImageResponse {
  images: Record<string, string | null>;
  err?: string;
}

export class FigmaRateLimitError extends Error {
  retryAfterTimestamp: number;
  limitType: string | null;

  constructor(message: string, retryAfterTimestamp: number, limitType: string | null) {
    super(message);
    this.name = 'FigmaRateLimitError';
    this.retryAfterTimestamp = retryAfterTimestamp;
    this.limitType = limitType;
  }
}

/**
 * Fetches component images from Figma API for given node IDs.
 * Throws FigmaRateLimitError on 429, Error on other non-OK responses.
 */
export async function fetchFigmaImages(
  fileKey: string,
  nodeIds: string[],
  accessToken: string,
  format: 'png' | 'jpg' | 'svg' | 'pdf' = 'png',
  scale = 1,
): Promise<FigmaImageResponse> {
  const params = new URLSearchParams({
    ids: nodeIds.join(','),
    format,
    scale: String(scale),
  });

  const url = `${FIGMA_API_BASE}/v1/images/${fileKey}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      'X-Figma-Token': accessToken,
      'Accept': 'application/json',
    },
  });

  if (response.status === 429) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
    const retryAfterTimestamp = Date.now() + retryAfterSeconds * 1000;
    const limitType = response.headers.get('X-RateLimit-Type');

    throw new FigmaRateLimitError(
      `Figma API rate limit exceeded. Retry after ${retryAfterSeconds}s.`,
      retryAfterTimestamp,
      limitType,
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Figma API error: ${response.status} ${response.statusText} — ${body}`,
    );
  }

  return response.json() as Promise<FigmaImageResponse>;
}
