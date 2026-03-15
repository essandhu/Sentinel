import { describe, it, expect } from 'vitest';
import { computeShardPlan, CAPTURES_PER_SHARD, type Route } from './shard-plan.js';

function makeRoutes(count: number): Route[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `route-${i}`,
    path: `/page-${i}`,
  }));
}

describe('shard-plan', () => {
  describe('CAPTURES_PER_SHARD', () => {
    it('equals 25', () => {
      expect(CAPTURES_PER_SHARD).toBe(25);
    });
  });

  describe('computeShardPlan', () => {
    it('puts all routes in one shard when total captures <= CAPTURES_PER_SHARD', () => {
      const routes = makeRoutes(5);
      const viewports = ['1280x720'];
      const browsers = ['chromium'];

      const plan = computeShardPlan(routes, viewports, browsers);

      expect(plan.shardCount).toBe(1);
      expect(plan.totalCaptures).toBe(5);
      expect(plan.shards).toHaveLength(1);
      expect(plan.shards[0].routes).toEqual(routes);
      expect(plan.shards[0].viewports).toEqual(viewports);
      expect(plan.shards[0].browsers).toEqual(browsers);
    });

    it('auto-splits into multiple shards when captures exceed threshold', () => {
      const routes = makeRoutes(30);
      const viewports = ['1280x720', '375x667'];
      const browsers = ['chromium'];

      // totalCaptures = 30 * 2 * 1 = 60, ceil(60/25) = 3 shards
      const plan = computeShardPlan(routes, viewports, browsers);

      expect(plan.totalCaptures).toBe(60);
      expect(plan.shardCount).toBe(3);
      expect(plan.shards).toHaveLength(3);

      // All routes should be distributed across shards
      const allRoutes = plan.shards.flatMap((s) => s.routes);
      expect(allRoutes).toHaveLength(30);
    });

    it('distributes routes round-robin across shards', () => {
      const routes = makeRoutes(7);
      const viewports = ['1280x720'];
      const browsers = ['chromium'];

      const plan = computeShardPlan(routes, viewports, browsers, { shardCount: 3 });

      // 7 routes across 3 shards: [0,3,6], [1,4], [2,5]
      expect(plan.shards[0].routes).toHaveLength(3);
      expect(plan.shards[1].routes).toHaveLength(2);
      expect(plan.shards[2].routes).toHaveLength(2);

      expect(plan.shards[0].routes[0].name).toBe('route-0');
      expect(plan.shards[0].routes[1].name).toBe('route-3');
      expect(plan.shards[0].routes[2].name).toBe('route-6');
      expect(plan.shards[1].routes[0].name).toBe('route-1');
    });

    it('respects explicit shardCount option', () => {
      const routes = makeRoutes(10);
      const viewports = ['1280x720'];
      const browsers = ['chromium'];

      const plan = computeShardPlan(routes, viewports, browsers, { shardCount: 5 });

      expect(plan.shardCount).toBe(5);
      expect(plan.shards).toHaveLength(5);
    });

    it('filters out empty shards when shardCount exceeds route count', () => {
      const routes = makeRoutes(2);
      const viewports = ['1280x720'];
      const browsers = ['chromium'];

      const plan = computeShardPlan(routes, viewports, browsers, { shardCount: 10 });

      // Only 2 routes, so 8 shards would be empty
      expect(plan.shardCount).toBe(2);
      expect(plan.shards).toHaveLength(2);
    });

    it('gives every shard all viewports and browsers', () => {
      const routes = makeRoutes(4);
      const viewports = ['1280x720', '375x667'];
      const browsers = ['chromium', 'firefox'];

      const plan = computeShardPlan(routes, viewports, browsers, { shardCount: 2 });

      for (const shard of plan.shards) {
        expect(shard.viewports).toEqual(viewports);
        expect(shard.browsers).toEqual(browsers);
      }
    });

    it('handles single route', () => {
      const routes = makeRoutes(1);
      const plan = computeShardPlan(routes, ['1280x720'], ['chromium']);

      expect(plan.shardCount).toBe(1);
      expect(plan.totalCaptures).toBe(1);
      expect(plan.shards[0].routes).toHaveLength(1);
    });

    it('computes totalCaptures as routes * viewports * browsers', () => {
      const routes = makeRoutes(3);
      const viewports = ['1280x720', '375x667'];
      const browsers = ['chromium', 'firefox', 'webkit'];

      const plan = computeShardPlan(routes, viewports, browsers);

      expect(plan.totalCaptures).toBe(3 * 2 * 3);
    });

    it('preserves route mask and parameterName fields', () => {
      const routes: Route[] = [
        { name: 'r1', path: '/p1', mask: ['.header'], parameterName: 'variant' },
        { name: 'r2', path: '/p2' },
      ];
      const plan = computeShardPlan(routes, ['1280x720'], ['chromium']);

      const allRoutes = plan.shards.flatMap((s) => s.routes);
      expect(allRoutes[0].mask).toEqual(['.header']);
      expect(allRoutes[0].parameterName).toBe('variant');
      expect(allRoutes[1].mask).toBeUndefined();
    });
  });
});
