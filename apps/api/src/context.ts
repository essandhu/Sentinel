import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';

// Import getAuth conditionally - Clerk may not be configured in all environments
let getAuthFn: ((req: any) => any) | null = null;

try {
  const clerkModule = await import('@clerk/fastify');
  getAuthFn = clerkModule.getAuth;
} catch {
  // Clerk not available
}

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  // When Clerk is active (plugin registered), getAuth returns auth state
  // When Clerk is not configured, auth will be null
  let auth = null;

  if (getAuthFn) {
    try {
      auth = getAuthFn(req);
    } catch {
      // Clerk not registered on this request (e.g., testing without CLERK_SECRET_KEY)
      auth = null;
    }
  }

  return { auth, req, res };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
