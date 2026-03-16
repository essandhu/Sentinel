export interface DiscoveredRoute {
  path: string;
  name: string;
  source: 'framework' | 'crawl' | 'sitemap';
}

export interface RouteExtractor {
  name: string;
  detect: (cwd: string) => Promise<boolean>;
  extract: (cwd: string) => Promise<DiscoveredRoute[]>;
}
