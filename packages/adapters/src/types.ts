import type { AdapterConfig } from '@sentinel-vrt/types';

export interface ImageAdapterConfig extends AdapterConfig {
  directory: string;
}

export interface StorybookAdapterConfig extends AdapterConfig {
  storybookUrl: string;
  storyIds?: string[];
}

export interface DesignTokenAdapterConfig extends AdapterConfig {
  tokenFilePath: string;
}

export interface FigmaAdapterConfig extends AdapterConfig {
  accessToken: string;
  fileKey: string;
  nodeIds: string[];
  cacheBucket: string;
  dbConnectionString: string;
}

export interface SketchAdapterConfig extends AdapterConfig {
  filePath: string;
  fallbackDirectory?: string;
}

export interface PenpotAdapterConfig extends AdapterConfig {
  instanceUrl: string;
  accessToken: string;
  fileId: string;
  componentIds?: string[];
}

export interface ZeroheightAdapterConfig extends AdapterConfig {
  orgUrl: string;
  tokenSetId: string;
  clientId: string;
  accessToken: string;
}
