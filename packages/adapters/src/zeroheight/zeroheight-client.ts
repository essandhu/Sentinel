const ZH_OPEN_API = 'https://zeroheight.com/open_api/v2';

export class ZeroheightApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ZeroheightApiError';
    this.status = status;
  }
}

/**
 * Fetches token sets for a styleguide from the Zeroheight Open API.
 * Returns the parsed JSON response.
 */
export async function fetchTokenSets(
  clientId: string,
  accessToken: string,
  styleguideId: string,
): Promise<unknown> {
  const url = `${ZH_OPEN_API}/token-sets?styleguide_id=${encodeURIComponent(styleguideId)}`;
  const response = await fetch(url, {
    headers: {
      'X-API-CLIENT': clientId,
      'X-API-KEY': accessToken,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ZeroheightApiError(
      `Token sets fetch failed: ${response.status} — ${text}`,
      response.status,
    );
  }

  return response.json();
}

/**
 * Fetches a token export from Zeroheight's token management API.
 * Returns the parsed JSON token data.
 */
export async function fetchTokenExport(
  orgUrl: string,
  tokenSetId: string,
  clientId: string,
  accessToken: string,
  format: string = 'json',
): Promise<Record<string, unknown>> {
  const base = orgUrl.replace(/\/$/, '');
  const url = `${base}/api/token_management/token_set/${encodeURIComponent(tokenSetId)}/export?format=${encodeURIComponent(format)}`;
  const response = await fetch(url, {
    headers: {
      'X-API-CLIENT': clientId,
      'X-API-KEY': accessToken,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ZeroheightApiError(
      `Token export failed: ${response.status} — ${text}`,
      response.status,
    );
  }

  return response.json() as Promise<Record<string, unknown>>;
}

/**
 * Validates a Zeroheight connection by fetching token sets for the given styleguide.
 * Returns void on success, throws ZeroheightApiError on failure.
 */
export async function validateZeroheightConnection(
  clientId: string,
  accessToken: string,
  styleguideId: string,
): Promise<void> {
  await fetchTokenSets(clientId, accessToken, styleguideId);
}
