import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth } from '@clerk/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { TRPCProvider, queryClient, trpcClient, setClerkTokenGetter } from './trpc';
import { ThemeProvider } from './hooks/useTheme';
import { App } from './App';
import './index.css';

const isLocalMode = __SENTINEL_MODE__ === 'local';

const PUBLISHABLE_KEY = isLocalMode ? '' : (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '');

if (!isLocalMode && !PUBLISHABLE_KEY) {
  console.warn(
    'Missing VITE_CLERK_PUBLISHABLE_KEY — Clerk auth features will not work. ' +
    'Set this env var in .env.local for local development.'
  );
}

/**
 * Bridges the Clerk useAuth() hook (React context) to the module-level tRPC client.
 * Must be rendered inside ClerkProvider but outside TRPCProvider so the token getter
 * is available before any tRPC requests fire.
 */
function ClerkTokenSync() {
  const { getToken } = useAuth();
  useEffect(() => {
    setClerkTokenGetter(getToken);
  }, [getToken]);
  return null;
}

const appCore = (
  <QueryClientProvider client={queryClient}>
    <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </TRPCProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById('root')!).render(
  !isLocalMode && PUBLISHABLE_KEY
    ? (
      <StrictMode>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
          <ClerkTokenSync />
          {appCore}
        </ClerkProvider>
      </StrictMode>
    )
    : (
      <StrictMode>
        {appCore}
      </StrictMode>
    )
);
