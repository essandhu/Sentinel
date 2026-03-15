import { verifyToken } from '@clerk/backend';

export interface WsAuthResult {
  userId: string;
  orgId: string;
}

export async function authenticateWsConnection(
  token: string | undefined,
): Promise<WsAuthResult | null> {
  if (!token || !process.env.CLERK_SECRET_KEY) return null;

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    if (!payload.sub || !payload.org_id) return null;
    return { userId: payload.sub, orgId: payload.org_id };
  } catch {
    return null;
  }
}
