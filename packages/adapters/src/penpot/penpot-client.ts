const PENPOT_RPC_BASE = '/api/rpc/command';

export class PenpotApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PenpotApiError';
    this.status = status;
  }
}

/**
 * Low-level Penpot RPC call. GET when no body, POST when body provided.
 * All requests use `Authorization: Token <token>` and `Accept: application/json`.
 */
export async function penpotRpc(
  instanceUrl: string,
  command: string,
  accessToken: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const base = instanceUrl.replace(/\/$/, '');
  const url = `${base}${PENPOT_RPC_BASE}/${command}`;
  const method = body ? 'POST' : 'GET';

  const headers: Record<string, string> = {
    Authorization: `Token ${accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new PenpotApiError(
      `Penpot RPC ${command} failed: ${response.status} — ${text}`,
      response.status,
    );
  }

  return response.json();
}

/**
 * Validates a Penpot connection by calling get-profile.
 * Returns the user profile on success, throws PenpotApiError on failure (e.g. 401).
 */
export async function validatePenpotConnection(
  instanceUrl: string,
  token: string,
): Promise<{ id: string; fullname: string; email: string }> {
  const result = await penpotRpc(instanceUrl, 'get-profile', token);
  return result as { id: string; fullname: string; email: string };
}

/**
 * Fetches components from a Penpot file via the get-file RPC command.
 * Returns an array of { id, name, type } extracted from the file's component map.
 */
export async function getPenpotFileComponents(
  instanceUrl: string,
  token: string,
  fileId: string,
): Promise<Array<{ id: string; name: string; type: string }>> {
  const file = (await penpotRpc(instanceUrl, 'get-file', token, {
    id: fileId,
    components: true,
  })) as { data: { components: Record<string, { id: string; name: string; type: string }> } };

  const componentsMap = file.data?.components ?? {};
  return Object.values(componentsMap).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
  }));
}

/**
 * Exports a Penpot component as a PNG image buffer.
 * Best-effort: returns null on export failure instead of throwing.
 */
export async function exportPenpotComponent(
  instanceUrl: string,
  token: string,
  fileId: string,
  componentId: string,
): Promise<Buffer | null> {
  const base = instanceUrl.replace(/\/$/, '');
  const url = `${base}/api/export`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        Accept: 'application/octet-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: fileId,
        object_id: componentId,
        type: 'png',
        scale: 1,
      }),
    });

    if (!response.ok) {
      console.warn(
        `Penpot export failed for component ${componentId}: ${response.status}`,
      );
      return null;
    }

    return Buffer.from(await response.arrayBuffer());
  } catch (err) {
    console.warn(
      `Penpot export failed for component ${componentId}: ${(err as Error).message}`,
    );
    return null;
  }
}
