import type { z } from 'zod';
import type { RouteSchema, ParameterDimensionSchema } from './config-schema.js';

type RouteInput = z.infer<typeof RouteSchema>;
type ParameterDimension = z.infer<typeof ParameterDimensionSchema>;

export interface ExpandedRoute {
  path: string;
  name: string;
  viewports?: string[];
  mask?: string[];
  parameterName: string | null;
  parameterValues: Record<string, string>;
}

export interface ExpansionResult {
  routes: ExpandedRoute[];
  totalCaptures: number;
  truncated: boolean;
  truncatedAt?: number;
}

/**
 * Compute the cartesian product of all parameter dimensions.
 * Returns an array of Records mapping dimension name to a single value.
 */
function cartesianProduct(
  dimensions: [string, ParameterDimension][],
): Record<string, string>[] {
  if (dimensions.length === 0) return [];

  let combos: Record<string, string>[] = [{}];

  for (const [key, dim] of dimensions) {
    const next: Record<string, string>[] = [];
    for (const combo of combos) {
      for (const value of dim.values) {
        next.push({ ...combo, [key]: value });
      }
    }
    combos = next;
  }

  return combos;
}

/**
 * Build a deterministic parameterName from a combination.
 * Keys are sorted alphabetically, values joined with '|'.
 */
function buildParameterName(combo: Record<string, string>): string {
  const sortedKeys = Object.keys(combo).sort();
  return sortedKeys.map((k) => combo[k]).join('|');
}

/**
 * Expand routes by their parameter matrix.
 *
 * Routes without parameters (or with empty parameters) pass through
 * with parameterName=null.
 *
 * The safety valve `maxCapturesPerRun` limits the total number of
 * captures (expanded routes * viewportCount * browserCount).
 */
export function expandParameterMatrix(
  routes: RouteInput[],
  viewportCount: number,
  browserCount: number,
  maxCapturesPerRun: number = 500,
): ExpansionResult {
  const expanded: ExpandedRoute[] = [];
  let truncated = false;
  let truncatedAt: number | undefined;

  const capturesPerRoute = viewportCount * browserCount;

  for (const route of routes) {
    const dimensions = Object.entries(route.parameters ?? {});

    if (dimensions.length === 0) {
      // No parameters -- pass through
      const newTotal = (expanded.length + 1) * capturesPerRoute;
      if (newTotal > maxCapturesPerRun) {
        truncated = true;
        truncatedAt = expanded.length * capturesPerRoute;
        break;
      }
      expanded.push({
        path: route.path,
        name: route.name,
        viewports: route.viewports,
        mask: route.mask,
        parameterName: null,
        parameterValues: {},
      });
      continue;
    }

    const combos = cartesianProduct(dimensions);

    for (const combo of combos) {
      const newTotal = (expanded.length + 1) * capturesPerRoute;
      if (newTotal > maxCapturesPerRun) {
        truncated = true;
        truncatedAt = expanded.length * capturesPerRoute;
        break;
      }

      expanded.push({
        path: route.path,
        name: route.name,
        viewports: route.viewports,
        mask: route.mask,
        parameterName: buildParameterName(combo),
        parameterValues: combo,
      });
    }

    if (truncated) break;
  }

  return {
    routes: expanded,
    totalCaptures: expanded.length * capturesPerRoute,
    truncated,
    truncatedAt,
  };
}
