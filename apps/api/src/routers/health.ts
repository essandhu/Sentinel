import { t } from '../trpc.js';

export const healthRouter = t.router({
  check: t.procedure.query(() => {
    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    };
  }),
});
