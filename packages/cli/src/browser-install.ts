import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

function getPlaywrightCliPath(): string {
  const require = createRequire(import.meta.url);
  // Resolve the package.json (which is always exported) to find the package root
  const pkgJson = require.resolve('playwright-core/package.json');
  return join(dirname(pkgJson), 'cli.js');
}

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
      const cliPath = getPlaywrightCliPath();
      execSync(`node "${cliPath}" install ${browser}`, { stdio: 'inherit' });
      console.log(chalk.green(`${browser} installed successfully.`));
    } catch (err) {
      console.error(chalk.red(`Failed to install ${browser}. Please run: npx playwright install ${browser}`));
      process.exit(1);
    }
  }
}

function isBrowserInstalled(browser: string): boolean {
  try {
    // Use playwright-core's registry to check if the browser executable exists
    const cliPath = getPlaywrightCliPath();
    const output = execSync(`node "${cliPath}" install --dry-run 2>&1`, {
      stdio: 'pipe',
      timeout: 15000,
    }).toString();

    // Parse the dry-run output to find the install location for this browser
    // Format: "Chrome for Testing ... (playwright chromium v1208)"
    //         "  Install location:    C:\...\chromium-1208"
    const lines = output.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(`playwright ${browser} `) || line.includes(`playwright ${browser}-`)) {
        // Next line should be the install location
        const locationLine = lines[i + 1];
        if (locationLine && locationLine.includes('Install location:')) {
          const installPath = locationLine.split('Install location:')[1].trim();
          return existsSync(installPath);
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}
