import chalk from 'chalk';
import { watch } from 'node:fs';
import { resolve } from 'node:path';

export interface DebouncedCallback {
  (): void;
  cancel: () => void;
}

export const createDebouncedCallback = (
  callback: () => void | Promise<void>,
  delayMs: number,
): DebouncedCallback => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      await callback();
    }, delayMs);
  }) as DebouncedCallback;

  debounced.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };

  return debounced;
};

interface WatchOptions {
  config?: string;
  port?: string;
}

export const watchCommand = async (options: WatchOptions): Promise<void> => {
  const { loadConfig } = await import('@sentinel-vrt/capture');
  const config = await loadConfig(options.config ?? 'sentinel.config.yml');

  const watchConfig = (config as any).watch;
  if (!watchConfig) {
    console.log(chalk.yellow('No watch.paths configured in sentinel.config.yml.'));
    console.log(chalk.dim('Add a watch block:\n  watch:\n    paths: ["src/**"]'));
    return;
  }

  try {
    const response = await fetch(config.baseUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    console.log(chalk.red(`Cannot reach ${config.baseUrl}. Start your dev server first.`));
    return;
  }

  console.log(chalk.blue.bold('Sentinel Watch Mode'));
  console.log(chalk.dim(`Watching: ${watchConfig.paths.join(', ')}`));
  console.log(chalk.dim(`Debounce: ${watchConfig.debounceMs ?? 500}ms`));
  console.log(chalk.dim(`Base URL: ${config.baseUrl}`));
  console.log(chalk.dim('Press Ctrl+C to stop.\n'));

  let runCount = 0;

  const runCapture = async () => {
    runCount++;
    if (watchConfig.clearScreen !== false) process.stdout.write('\x1Bc');
    console.log(chalk.blue(`[Run #${runCount}] Capturing...`));
    try {
      const { captureCommand } = await import('./capture.js');
      await captureCommand({ config: options.config ?? 'sentinel.config.yml', ci: false });
    } catch (err) {
      console.log(chalk.red(`Capture failed: ${err instanceof Error ? err.message : err}`));
    }
    console.log(chalk.dim('\nWaiting for changes...'));
  };

  const debounced = createDebouncedCallback(runCapture, watchConfig.debounceMs ?? 500);

  const watchers: ReturnType<typeof watch>[] = [];
  const cwd = process.cwd();
  for (const pattern of watchConfig.paths as string[]) {
    const baseDir = resolve(cwd, pattern.replace(/[*?{[].*$/, '').replace(/\/$/, '') || '.');
    try {
      const watcher = watch(baseDir, { recursive: true }, () => debounced());
      watchers.push(watcher);
    } catch (err) {
      console.log(chalk.yellow(`Warning: cannot watch ${baseDir}: ${err instanceof Error ? err.message : err}`));
    }
  }

  if (watchers.length === 0) {
    console.log(chalk.red('No valid watch paths found.'));
    return;
  }

  await runCapture();
  console.log(chalk.dim('\nWaiting for changes...'));

  const cleanup = () => {
    debounced.cancel();
    for (const w of watchers) w.close();
    console.log(chalk.dim('\nWatch stopped.'));
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  await new Promise(() => {});
};
