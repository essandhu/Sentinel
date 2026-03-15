import chalk from 'chalk';
import { execSync } from 'node:child_process';

export async function ensureBrowserInstalled(browsers: string[] = ['chromium']): Promise<void> {
  const isCi = process.env.CI === 'true' || process.argv.includes('--ci');

  for (const browser of browsers) {
    if (isBrowserInstalled(browser)) continue;

    if (!isCi) {
      // Dynamic import to keep non-capture commands fast
      const { confirm } = await import('@inquirer/prompts');
      const proceed = await confirm({
        message: `${browser} browser not found. Sentinel needs to download it (~130MB) to take screenshots.\nDownload now?`,
        default: true,
      });

      if (!proceed) {
        console.error(chalk.red('Cannot run captures without a browser. Exiting.'));
        process.exit(1);
      }
    } else {
      console.log(chalk.blue(`Installing ${browser} browser for CI...`));
    }

    console.log(chalk.dim(`Downloading ${browser}...`));
    try {
      execSync(`npx playwright install ${browser}`, { stdio: 'inherit' });
      console.log(chalk.green(`${browser} installed successfully.`));
    } catch (err) {
      console.error(chalk.red(`Failed to install ${browser}. Please run: npx playwright install ${browser}`));
      process.exit(1);
    }
  }
}

function isBrowserInstalled(browser: string): boolean {
  try {
    // Check if playwright can find the browser
    const output = execSync(`npx playwright install --dry-run 2>&1`, {
      stdio: 'pipe',
      timeout: 10000,
    }).toString();
    // If the browser is already installed, dry-run won't list it as needing installation
    return !output.includes(browser);
  } catch {
    // If playwright isn't installed at all, browsers definitely aren't
    return false;
  }
}
