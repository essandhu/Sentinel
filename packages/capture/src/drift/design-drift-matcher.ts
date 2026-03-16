import { readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

export interface DesignDriftMapping { design: string; route: string; viewport: string; }
export interface DiscoveredDesignImage { routeName: string; viewport: string; filePath: string; }

const CONVENTION_PATTERN = /^(.+)_(\d+x\d+)\.png$/;
const normalize = (p: string): string => p.replace(/\\/g, '/');

const fileExists = async (path: string): Promise<boolean> => {
  try { await access(path); return true; } catch { return false; }
};

export const matchDesignToRoute = async (
  routeName: string, viewport: string, designDir: string,
  mappings?: DesignDriftMapping[], routePath?: string,
): Promise<string | null> => {
  if (mappings && routePath) {
    const mapping = mappings.find(m => m.route === routePath && m.viewport === viewport);
    if (mapping) {
      const path = join(designDir, mapping.design);
      return await fileExists(path) ? normalize(path) : null;
    }
  }
  const conventionPath = join(designDir, `${routeName}_${viewport}.png`);
  return await fileExists(conventionPath) ? normalize(conventionPath) : null;
};

export const discoverDesignImages = async (designDir: string): Promise<DiscoveredDesignImage[]> => {
  try {
    const files = await readdir(designDir);
    const images: DiscoveredDesignImage[] = [];
    for (const file of files) {
      const match = CONVENTION_PATTERN.exec(String(file));
      if (match) images.push({ routeName: match[1], viewport: match[2], filePath: normalize(join(designDir, String(file))) });
    }
    return images;
  } catch { return []; }
};
