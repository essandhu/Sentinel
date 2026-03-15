const FIGMA_API_BASE = 'https://api.figma.com';

export interface FigmaWebhookRegistration {
  id: string;
  status: string;
}

/**
 * Registers a webhook with the Figma V2 API for LIBRARY_PUBLISH events on a file.
 *
 * @param accessToken - Figma personal access token
 * @param fileKey - The Figma file key to watch
 * @param endpointUrl - The URL Figma will POST webhook events to
 * @param passcode - Shared secret for HMAC signature verification
 * @returns The webhook registration id and status
 */
export async function registerFigmaWebhook(
  accessToken: string,
  fileKey: string,
  endpointUrl: string,
  passcode: string,
): Promise<FigmaWebhookRegistration> {
  const response = await fetch(`${FIGMA_API_BASE}/v2/webhooks`, {
    method: 'POST',
    headers: {
      'X-Figma-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'LIBRARY_PUBLISH',
      context: 'file',
      context_id: fileKey,
      endpoint: endpointUrl,
      passcode,
      description: `Sentinel auto-sync for ${fileKey}`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Figma webhook registration failed: ${response.status} — ${body}`,
    );
  }

  const data = (await response.json()) as { id: string; status: string };
  return { id: data.id, status: data.status };
}

/**
 * Deletes a Figma webhook by ID via the V2 API.
 *
 * @param accessToken - Figma personal access token
 * @param webhookId - The webhook ID to delete
 */
export async function deleteFigmaWebhook(
  accessToken: string,
  webhookId: string,
): Promise<void> {
  const response = await fetch(`${FIGMA_API_BASE}/v2/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: {
      'X-Figma-Token': accessToken,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Figma webhook deletion failed: ${response.status} — ${body}`,
    );
  }
}
