export interface DesignSpec {
  sourceType: 'image' | 'figma' | 'storybook' | 'tokens' | 'sketch' | 'penpot';
  referenceImage?: Buffer;
  tokens?: Record<string, TokenValue>;
  metadata: {
    componentName?: string;
    storyId?: string;
    figmaNodeId?: string;
    sketchArtboardId?: string;
    penpotComponentId?: string;
    capturedAt?: string;
  };
}

export interface TokenValue {
  type: string;
  value: string | number;
}

export interface DesignSourceAdapter {
  name: string;
  load(config: AdapterConfig): Promise<DesignSpec>;
  loadAll(config: AdapterConfig): Promise<DesignSpec[]>;
}

export interface AdapterConfig {
  [key: string]: unknown;
}
