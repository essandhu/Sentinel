import { createRequire } from 'node:module';
import { Command } from 'commander';
import { approveCommand } from './commands/approve.js';
import { captureCommand } from './commands/capture.js';
import { configValidateCommand } from './commands/config-validate.js';
import { dashboardCommand } from './commands/dashboard.js';
import { initCommand } from './commands/init.js';
import { loginCommand } from './commands/login.js';
import { reportCommand } from './commands/report.js';
import { resetCommand } from './commands/reset.js';

// Re-export types and functions for programmatic use (e.g. GitHub Action)
export type { DiffEntry, DiffSummary, BudgetResultEntry, CaptureOptions } from './commands/capture.js';
export { runCapture } from './commands/capture-local.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('sentinel')
  .description('Sentinel visual regression testing CLI')
  .version(version);

program
  .command('capture')
  .description('Run a capture-and-diff cycle against the configured routes')
  .option('-c, --config <path>', 'Path to sentinel config file', 'sentinel.config.yml')
  .option('--commit-sha <sha>', 'Git commit SHA to associate with this run')
  .option('--branch <name>', 'Git branch name to associate with this run')
  .option('--suite <name>', 'Run only routes in the named suite')
  .option('--plan <name>', 'Execute a test plan (ordered suite sequence with gating)')
  .option('--ci', 'CI mode: auto-download browsers, JSON output, no prompts')
  .option('--remote', 'Use remote server mode (requires sentinel login)')
  .action(captureCommand);

program
  .command('init')
  .description('Initialize a new Sentinel project with config scaffolding')
  .option('--cwd <path>', 'Working directory', '.')
  .action(initCommand);

program
  .command('login')
  .description('Authenticate with a Sentinel server')
  .action(loginCommand);

program
  .command('approve')
  .description('Review and approve/reject diffs from last capture run')
  .option('--all', 'Approve all pending diffs')
  .option('--run <runId>', 'Approve diffs from a specific run')
  .action(approveCommand);

program
  .command('dashboard')
  .description('Start local web UI for visual diff review')
  .option('-p, --port <port>', 'Port to run on', '5678')
  .option('--no-browser', 'Do not open browser automatically')
  .action(dashboardCommand);

const configCmd = program
  .command('config')
  .description('Configuration management');

configCmd
  .command('validate')
  .description('Validate sentinel.config.yml')
  .option('-c, --config <path>', 'Path to config file', 'sentinel.config.yml')
  .action(configValidateCommand);

program
  .command('report')
  .description('Generate static HTML report from last capture run')
  .option('--run <runId>', 'Generate report for a specific run')
  .option('-o, --output <path>', 'Output file path')
  .action(reportCommand);

program
  .command('reset')
  .description('Clear .sentinel/ directory and start fresh')
  .action(resetCommand);

export { program };

await program.parseAsync(process.argv);
