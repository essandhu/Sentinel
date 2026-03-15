import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // vitest 4.x: workspace replaced by projects
    // apps/vscode excluded: tests require VS Code Extension Development Host
    // and the 'vscode' module alias does not resolve in workspace mode.
    // Run vscode tests independently: cd apps/vscode && pnpm vitest run
    projects: [
      'packages/*/vitest.config.ts',
      'apps/action/vitest.config.ts',
      'apps/api/vitest.config.ts',
      'apps/dashboard/vitest.config.ts',
      'tests/e2e/vitest.config.ts',
    ],
  },
});
