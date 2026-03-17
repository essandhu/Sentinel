import { createTRPCContext, createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { QueryClient } from '@tanstack/react-query';
import type { AppRouter } from '@sentinel-vrt/api/router';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Token getter that will be set by the React tree via ClerkTokenSync
let _getToken: (() => Promise<string | null>) | null = null;

export function setClerkTokenGetter(getter: () => Promise<string | null>) {
  _getToken = getter;
}

const isLocalMode = __SENTINEL_MODE__ === 'local';

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: isLocalMode ? 'http://localhost:5678/trpc' : '/trpc',
      headers: async () => {
        if (!isLocalMode && _getToken) {
          const token = await _getToken();
          if (token) {
            return { Authorization: `Bearer ${token}` };
          }
        }
        return {};
      },
    }),
  ],
});

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
export const trpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient });
