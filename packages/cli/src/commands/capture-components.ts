export interface ComponentCaptureOptions {
  config: string;
  ci?: boolean;
  branch?: string;
  commitSha?: string;
}

export const componentsToAdapterConfig = (
  components: { source: string; url?: string; [key: string]: any },
): { type: 'storybook'; storybookUrl: string; storyIds?: string[] } => ({
  type: 'storybook' as const,
  storybookUrl: components.url ?? 'http://localhost:6006',
  storyIds: undefined,
});

export const isStorybookRunning = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
};

export const filterStories = (
  storyNames: string[],
  include?: string[],
  exclude?: string[],
): string[] => {
  let filtered = storyNames;
  if (include && include.length > 0) {
    filtered = filtered.filter(name => include.some(pattern => matchGlob(pattern, name)));
  }
  if (exclude && exclude.length > 0) {
    filtered = filtered.filter(name => !exclude.some(pattern => matchGlob(pattern, name)));
  }
  return filtered;
};

const matchGlob = (pattern: string, str: string): boolean => {
  const regex = pattern
    .replace(/\*\*/g, '{{DOUBLESTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{DOUBLESTAR\}\}/g, '.*');
  return new RegExp(`^${regex}$`).test(str);
};
