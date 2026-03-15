import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    exclude: ['dist/**', 'node_modules/**'],
    // Many API tests call buildServer() which starts a Fastify instance.
    // Running these in parallel causes port/resource conflicts and timeouts.
    fileParallelism: false,
    // Clear infrastructure env vars so tests use in-memory/mock stores.
    // Tests that need real services should set their own env or use skipIf.
    env: {
      CLERK_SECRET_KEY: '',
      CLERK_PUBLISHABLE_KEY: '',
      REDIS_URL: '',
    },
  },
});
