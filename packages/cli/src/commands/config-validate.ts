import chalk from 'chalk';

interface ValidateOptions {
  config?: string;
}

export async function configValidateCommand(options: ValidateOptions): Promise<void> {
  const configPath = options.config ?? 'sentinel.config.yml';
  try {
    const { loadConfig } = await import('@sentinel-vrt/capture');
    const config = await loadConfig(configPath);
    console.log(chalk.green(`✓ ${configPath} is valid`));
    console.log(chalk.dim(`  ${config.capture.routes.length} route(s)`));
    console.log(chalk.dim(`  ${(config.browsers ?? ['chromium']).length} browser(s)`));
  } catch (err) {
    console.error(chalk.red(`✗ ${configPath} is invalid:`));
    console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
    process.exitCode = 1;
  }
}
