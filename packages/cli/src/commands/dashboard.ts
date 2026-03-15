import chalk from 'chalk';
import { initLocalRuntime } from '../local-runtime.js';
import { startDashboardServer } from '../dashboard-server.js';

interface DashboardOptions {
  port?: string;
  browser: boolean; // --no-browser sets this to false
}

export async function dashboardCommand(options: DashboardOptions): Promise<void> {
  const port = parseInt(options.port ?? '5678', 10);
  const runtime = await initLocalRuntime(process.cwd());

  console.log(chalk.blue('Starting Sentinel dashboard...'));

  const { url, close } = await startDashboardServer(runtime, port);
  console.log(chalk.green(`\n  Dashboard running at ${url}\n`));

  if (options.browser !== false) {
    try {
      const open = (await import('open')).default;
      await open(url);
    } catch {
      // open may fail in headless environments
    }
  }

  console.log(chalk.dim('Press Ctrl+C to stop.\n'));

  const shutdown = async () => {
    console.log(chalk.dim('\nShutting down...'));
    await close();
    runtime.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep process alive
  await new Promise(() => {});
}
