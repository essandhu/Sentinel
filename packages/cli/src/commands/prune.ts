import chalk from 'chalk';
import { initLocalRuntime } from '../local-runtime.js';
import { findOrphanedBaselines } from './prune-logic.js';

export type { StoredBaseline } from './prune-logic.js';
export { findOrphanedBaselines } from './prune-logic.js';

interface PruneOptions {
  config?: string;
  confirm?: boolean;
}

export const pruneCommand = async (options: PruneOptions): Promise<void> => {
  const { loadConfig } = await import('@sentinel/capture');
  const config = await loadConfig(options.config ?? 'sentinel.config.yml');
  const runtime = await initLocalRuntime(process.cwd());

  try {
    const projectName = config.project ?? 'default';
    const project = await runtime.db.query.projects.findFirst({
      where: (projects: any, { eq }: any) => eq(projects.name, projectName),
    });

    if (!project) {
      console.log(chalk.yellow('No project found.'));
      return;
    }

    const client = (runtime.db as any).$client;
    const storedBaselines = client.prepare(
      'SELECT id, url, s3_key AS s3Key, viewport, browser FROM baselines WHERE project_id = ?'
    ).all(project.id);

    const configRoutes = config.capture.routes.map((r: any) => r.path);
    const orphans = findOrphanedBaselines(configRoutes, storedBaselines);

    if (orphans.length === 0) {
      console.log(chalk.green('No orphaned baselines found.'));
      return;
    }

    console.log(chalk.bold(`Found ${orphans.length} orphaned baseline(s):\n`));
    for (const orphan of orphans) {
      console.log(chalk.dim(`  ${orphan.url} @ ${orphan.viewport} [${orphan.browser}]`));
    }

    if (!options.confirm) {
      console.log(chalk.yellow('\nDry run — no files deleted. Use --confirm to delete.'));
      return;
    }

    for (const orphan of orphans) {
      try {
        await runtime.storage.delete(orphan.s3Key);
      } catch { /* Storage file may already be gone */ }
      client.prepare('DELETE FROM baselines WHERE id = ?').run(orphan.id);
    }

    console.log(chalk.green(`\nDeleted ${orphans.length} orphaned baseline(s).`));
  } finally {
    runtime.close();
  }
};
