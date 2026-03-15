import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { SentinelPlugin } from '@sentinel/types';

const PLUGIN_PREFIX = 'sentinel-plugin-';

/** A loaded and initialized plugin with its metadata */
export interface LoadedPlugin {
  plugin: SentinelPlugin;
  packageName: string;
  config: unknown;
}

/**
 * Discover sentinel-plugin-* packages in node_modules.
 * Returns an empty array if node_modules doesn't exist or is unreadable.
 */
export async function discoverPlugins(configDir: string): Promise<string[]> {
  const nodeModulesPath = resolve(configDir, 'node_modules');

  try {
    const entries = await readdir(nodeModulesPath);
    return entries.filter((name) => name.startsWith(PLUGIN_PREFIX));
  } catch {
    return [];
  }
}

/**
 * Load and validate a single plugin package.
 * Supports both default export and module-level export (mod.default ?? mod).
 * Validates config against plugin's configSchema if both exist.
 * Calls plugin.initialize() if the method exists.
 */
export async function loadPlugin(
  packageName: string,
  pluginConfig: unknown,
): Promise<LoadedPlugin> {
  const mod = await import(packageName);
  const plugin: SentinelPlugin = mod.default ?? mod;

  if (!plugin.name || !plugin.version) {
    throw new Error(`Plugin ${packageName} missing required name/version`);
  }

  // Validate config against plugin's own schema if provided
  if (plugin.configSchema && pluginConfig !== undefined) {
    plugin.configSchema.parse(pluginConfig);
  }

  // Initialize plugin
  if (plugin.initialize) {
    await plugin.initialize(pluginConfig);
  }

  return { plugin, packageName, config: pluginConfig };
}

/**
 * Discover and load all enabled plugins from node_modules.
 * Skips plugins with enabled: false in their config.
 * Logs errors for individual plugin failures but continues loading others.
 */
export async function loadAllPlugins(
  configDir: string,
  pluginsConfig: Record<string, { enabled?: boolean; config?: unknown }>,
): Promise<LoadedPlugin[]> {
  const discovered = await discoverPlugins(configDir);
  const loaded: LoadedPlugin[] = [];

  for (const packageName of discovered) {
    const entry = pluginsConfig[packageName];

    // Skip plugins not in config or explicitly disabled
    if (!entry || entry.enabled === false) {
      continue;
    }

    try {
      const result = await loadPlugin(packageName, entry.config);
      loaded.push(result);
    } catch (err) {
      console.error(`[plugin:${packageName}] Failed to load:`, err);
    }
  }

  return loaded;
}
