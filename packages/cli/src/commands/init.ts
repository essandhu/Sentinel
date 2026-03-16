import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { stringify as yamlStringify } from 'yaml';

// ── Framework Detection ─────────────────────────────────────────────────────

export interface FrameworkDetection {
  name: string;
  detect: (pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }) => boolean;
  defaultBaseUrl: string;
  defaultRoutes: string[];
}

const FRAMEWORKS: FrameworkDetection[] = [
  {
    name: 'next',
    detect: (pkg) => Boolean(pkg.dependencies?.next || pkg.devDependencies?.next),
    defaultBaseUrl: 'http://localhost:3000',
    defaultRoutes: ['/', '/about'],
  },
  {
    name: 'nuxt',
    detect: (pkg) => Boolean(pkg.dependencies?.nuxt || pkg.devDependencies?.nuxt),
    defaultBaseUrl: 'http://localhost:3000',
    defaultRoutes: ['/'],
  },
  {
    name: 'remix',
    detect: (pkg) => Boolean(pkg.dependencies?.['@remix-run/react'] || pkg.devDependencies?.['@remix-run/dev']),
    defaultBaseUrl: 'http://localhost:3000',
    defaultRoutes: ['/'],
  },
  {
    name: 'sveltekit',
    detect: (pkg) => Boolean(pkg.dependencies?.['@sveltejs/kit'] || pkg.devDependencies?.['@sveltejs/kit']),
    defaultBaseUrl: 'http://localhost:5173',
    defaultRoutes: ['/'],
  },
  {
    name: 'vite',
    detect: (pkg) =>
      Boolean(pkg.devDependencies?.vite || pkg.dependencies?.vite) &&
      Boolean(pkg.dependencies?.react || pkg.dependencies?.vue || pkg.dependencies?.svelte),
    defaultBaseUrl: 'http://localhost:5173',
    defaultRoutes: ['/'],
  },
  {
    name: 'cra',
    detect: (pkg) => Boolean(pkg.dependencies?.['react-scripts']),
    defaultBaseUrl: 'http://localhost:3000',
    defaultRoutes: ['/'],
  },
  {
    name: 'angular',
    detect: (pkg) => Boolean(pkg.dependencies?.['@angular/core']),
    defaultBaseUrl: 'http://localhost:4200',
    defaultRoutes: ['/'],
  },
];

/**
 * Detect the framework from package.json in the given directory.
 * Returns the matching FrameworkDetection or null.
 */
export async function detectFramework(cwd: string): Promise<FrameworkDetection | null> {
  try {
    const raw = await readFile(join(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw as string);
    for (const fw of FRAMEWORKS) {
      if (fw.detect(pkg)) return fw;
    }
  } catch {
    // No package.json or parse error
  }
  return null;
}

// ── Config Generation ───────────────────────────────────────────────────────

export interface GenerateConfigOptions {
  baseUrl: string;
  routes: string[];
  projectName: string;
  framework?: string;
  discoveryMode?: 'auto' | 'manual';
}

/**
 * Generate a sentinel.config.yml string from the given options.
 */
export function generateConfig(options: GenerateConfigOptions): string {
  const config: Record<string, unknown> = {
    project: options.projectName,
    baseUrl: options.baseUrl,
    capture: {
      routes: options.routes.map((path) => ({
        path: path.startsWith('/') ? path : `/${path}`,
        name: path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-'),
      })),
      viewports: ['1280x720', '375x667'],
    },
  };

  if (options.discoveryMode === 'auto') {
    config.discovery = { mode: 'auto' };
  }

  return yamlStringify(config);
}

// ── Interactive Init Command ────────────────────────────────────────────────

/**
 * Commander action for `sentinel init`.
 * Uses @inquirer/prompts for interactive input.
 */
export async function initCommand(opts: { cwd?: string }): Promise<void> {
  // Dynamic imports to avoid pulling in prompts/chalk for non-interactive use
  const { input, confirm, select } = await import('@inquirer/prompts');
  const chalk = (await import('chalk')).default;
  const { discoverRoutes } = await import('@sentinel/capture');

  const cwd = opts.cwd ?? process.cwd();
  const configPath = join(cwd, 'sentinel.config.yml');

  // Detect framework
  const framework = await detectFramework(cwd);
  if (framework) {
    console.log(chalk.green(`Detected framework: ${chalk.bold(framework.name)}`));
  } else {
    console.log(chalk.yellow('No recognized framework detected.'));
  }

  // Prompt for project name
  const projectName = await input({
    message: 'Project name:',
    default: cwd.split(/[\\/]/).pop() ?? 'my-project',
  });

  // Prompt for base URL
  const baseUrl = await input({
    message: 'Base URL:',
    default: framework?.defaultBaseUrl ?? 'http://localhost:3000',
  });

  // Auto-discover or manually input routes
  let routes: string[];
  let discoveryMode: 'auto' | 'manual' | undefined;

  const useAutoDiscovery = await confirm({
    message: 'Auto-discover routes?',
    default: true,
  });

  if (useAutoDiscovery) {
    const result = await discoverRoutes(cwd, baseUrl);
    if (result.routes.length > 0) {
      console.log(chalk.green(`Discovered ${chalk.bold(String(result.routes.length))} routes from: ${result.sources.join(', ')}`));
      for (const route of result.routes) {
        console.log(chalk.dim(`  ${route.path} (${route.source})`));
      }
      routes = result.routes.map((r) => r.path);
      discoveryMode = 'auto';
    } else {
      console.log(chalk.yellow('No routes discovered. Falling back to manual input.'));
      const routeInput = await input({
        message: 'Routes (comma-separated paths):',
        default: (framework?.defaultRoutes ?? ['/']).join(', '),
      });
      routes = routeInput.split(',').map((r) => r.trim()).filter(Boolean);
    }
  } else {
    const routeInput = await input({
      message: 'Routes (comma-separated paths):',
      default: (framework?.defaultRoutes ?? ['/']).join(', '),
    });
    routes = routeInput.split(',').map((r) => r.trim()).filter(Boolean);
  }

  // Check for existing config
  try {
    await access(configPath);
    const overwrite = await confirm({
      message: 'sentinel.config.yml already exists. Overwrite?',
      default: false,
    });
    if (!overwrite) {
      console.log(chalk.yellow('Aborted.'));
      return;
    }
  } catch {
    // File doesn't exist, proceed
  }

  // Generate and write config
  const yaml = generateConfig({ baseUrl, routes, projectName, framework: framework?.name, discoveryMode });
  await writeFile(configPath, yaml, 'utf-8');

  const { loadCredentials } = await import('./login.js');
  const creds = await loadCredentials();

  console.log(chalk.green(`\nCreated ${chalk.bold('sentinel.config.yml')}`));
  console.log(chalk.dim('\nNext steps:'));
  if (!creds) {
    console.log(chalk.dim('  1. Run: sentinel login'));
    console.log(chalk.dim('  2. Start your dev server'));
    console.log(chalk.dim('  3. Run: sentinel capture'));
  } else {
    console.log(chalk.dim('  1. Start your dev server'));
    console.log(chalk.dim('  2. Run: sentinel capture'));
  }
}
