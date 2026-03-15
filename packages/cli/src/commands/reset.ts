import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

export async function resetCommand(): Promise<void> {
  const sentinelDir = join(process.cwd(), '.sentinel');

  const confirmed = await confirm({
    message: `This will delete ${sentinelDir} and all stored captures/baselines. Continue?`,
    default: false,
  });

  if (!confirmed) {
    console.log(chalk.dim('Cancelled.'));
    return;
  }

  await rm(sentinelDir, { recursive: true, force: true });
  console.log(chalk.green('Reset complete. Run `sentinel capture` to start fresh.'));
}
