export interface StoredBaseline {
  id: string;
  url: string;
  s3Key: string;
  viewport: string;
  browser: string;
}

export const findOrphanedBaselines = (
  configRoutes: string[],
  baselines: StoredBaseline[],
): StoredBaseline[] => {
  const routeSet = new Set(configRoutes);
  return baselines.filter(b => !routeSet.has(b.url));
};
