/** Maximum captures per shard before auto-splitting */
export const CAPTURES_PER_SHARD = 25;

export interface Route {
  name: string;
  path: string;
  mask?: string[];
  parameterName?: string | null;
}

export interface ShardAssignment {
  routes: Route[];
  viewports: string[];
  browsers: string[];
}

export interface ShardPlan {
  shards: ShardAssignment[];
  totalCaptures: number;
  shardCount: number;
}

export interface ShardPlanOptions {
  shardCount?: number;
}

/**
 * Computes a shard plan that splits routes into balanced shards.
 *
 * Routes are distributed round-robin across shards. Each shard receives
 * ALL viewports and ALL browsers -- only routes are the sharding dimension.
 * Empty shards (when shardCount > routes.length) are filtered out.
 */
export function computeShardPlan(
  routes: Route[],
  viewports: string[],
  browsers: string[],
  options?: ShardPlanOptions,
): ShardPlan {
  const totalCaptures = routes.length * viewports.length * browsers.length;

  let shardCount =
    options?.shardCount ??
    Math.max(1, Math.ceil(totalCaptures / CAPTURES_PER_SHARD));

  // Distribute routes round-robin across shards
  const buckets: Route[][] = Array.from({ length: shardCount }, () => []);
  for (let i = 0; i < routes.length; i++) {
    buckets[i % shardCount].push(routes[i]);
  }

  // Filter out empty shards (when shardCount > routes.length)
  const shards: ShardAssignment[] = buckets
    .filter((bucket) => bucket.length > 0)
    .map((bucket) => ({
      routes: bucket,
      viewports,
      browsers,
    }));

  // Actual shard count after filtering empties
  shardCount = shards.length;

  return { shards, totalCaptures, shardCount };
}
