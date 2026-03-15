import { describe, it, expect } from 'vitest';
import { computeShardPlan, CAPTURES_PER_SHARD } from '../src/shard-plan.js';

describe('computeShardPlan', () => {
  it('Test 1: 1 route, 1 viewport, 1 browser -> 1 shard containing that route', () => {
    const routes = [{ name: 'home', path: '/' }];
    const viewports = ['1280x720'];
    const browsers = ['chromium'];

    const plan = computeShardPlan(routes, viewports, browsers);

    expect(plan.shardCount).toBe(1);
    expect(plan.shards).toHaveLength(1);
    expect(plan.shards[0].routes).toEqual(routes);
    expect(plan.shards[0].viewports).toEqual(viewports);
    expect(plan.shards[0].browsers).toEqual(browsers);
  });

  it('Test 2: 10 routes, 2 viewports, 3 browsers (60 captures) -> ceil(60/25) = 3 shards', () => {
    const routes = Array.from({ length: 10 }, (_, i) => ({ name: `route-${i}`, path: `/r/${i}` }));
    const viewports = ['1280x720', '375x667'];
    const browsers = ['chromium', 'firefox', 'webkit'];

    const plan = computeShardPlan(routes, viewports, browsers);

    expect(plan.totalCaptures).toBe(60);
    expect(plan.shardCount).toBe(Math.ceil(60 / CAPTURES_PER_SHARD));
    expect(plan.shards).toHaveLength(plan.shardCount);
  });

  it('Test 3: Routes distributed round-robin (route 0 -> shard 0, route 1 -> shard 1, etc.)', () => {
    const routes = Array.from({ length: 6 }, (_, i) => ({ name: `r${i}`, path: `/${i}` }));
    const viewports = ['1280x720'];
    const browsers = ['chromium'];

    // 6 captures / 25 per shard = 1 shard (all fit in one). Use override to force 3 shards.
    const plan = computeShardPlan(routes, viewports, browsers, { shardCount: 3 });

    expect(plan.shards[0].routes.map(r => r.name)).toEqual(['r0', 'r3']);
    expect(plan.shards[1].routes.map(r => r.name)).toEqual(['r1', 'r4']);
    expect(plan.shards[2].routes.map(r => r.name)).toEqual(['r2', 'r5']);
  });

  it('Test 4: Each shard receives ALL viewports and ALL browsers (only routes are split)', () => {
    const routes = Array.from({ length: 4 }, (_, i) => ({ name: `r${i}`, path: `/${i}` }));
    const viewports = ['1280x720', '375x667'];
    const browsers = ['chromium', 'firefox'];

    const plan = computeShardPlan(routes, viewports, browsers, { shardCount: 2 });

    for (const shard of plan.shards) {
      expect(shard.viewports).toEqual(viewports);
      expect(shard.browsers).toEqual(browsers);
    }
  });

  it('Test 5: Manual shardCount override (e.g., shardCount: 2) overrides auto calculation', () => {
    const routes = Array.from({ length: 100 }, (_, i) => ({ name: `r${i}`, path: `/${i}` }));
    const viewports = ['1280x720'];
    const browsers = ['chromium'];

    // Auto would be ceil(100/25) = 4, but we force 2
    const plan = computeShardPlan(routes, viewports, browsers, { shardCount: 2 });

    expect(plan.shardCount).toBe(2);
    expect(plan.shards).toHaveLength(2);
  });

  it('Test 6: shardCount > routes.length -> empty shards filtered out', () => {
    const routes = [{ name: 'home', path: '/' }, { name: 'about', path: '/about' }];
    const viewports = ['1280x720'];
    const browsers = ['chromium'];

    const plan = computeShardPlan(routes, viewports, browsers, { shardCount: 5 });

    // Only 2 routes, so max 2 non-empty shards
    expect(plan.shards).toHaveLength(2);
    for (const shard of plan.shards) {
      expect(shard.routes.length).toBeGreaterThan(0);
    }
    expect(plan.shardCount).toBe(2);
  });

  it('Test 7: shardCount: 1 -> single shard with all routes (opt-out of parallelization)', () => {
    const routes = Array.from({ length: 50 }, (_, i) => ({ name: `r${i}`, path: `/${i}` }));
    const viewports = ['1280x720', '375x667'];
    const browsers = ['chromium'];

    const plan = computeShardPlan(routes, viewports, browsers, { shardCount: 1 });

    expect(plan.shardCount).toBe(1);
    expect(plan.shards).toHaveLength(1);
    expect(plan.shards[0].routes).toHaveLength(50);
  });

  it('Test 8: totalCaptures in return = routes * viewports * browsers', () => {
    const routes = Array.from({ length: 7 }, (_, i) => ({ name: `r${i}`, path: `/${i}` }));
    const viewports = ['1280x720', '375x667', '768x1024'];
    const browsers = ['chromium', 'firefox'];

    const plan = computeShardPlan(routes, viewports, browsers);

    expect(plan.totalCaptures).toBe(7 * 3 * 2);
  });
});
