export interface BreakpointTemplate {
  name: string;
  width: number;
  height: number;
}

export const BREAKPOINT_TEMPLATES: Record<string, BreakpointTemplate[]> = {
  tailwind: [
    { name: 'sm', width: 640, height: 480 },
    { name: 'md', width: 768, height: 1024 },
    { name: 'lg', width: 1024, height: 768 },
    { name: 'xl', width: 1280, height: 800 },
    { name: '2xl', width: 1536, height: 864 },
  ],
  bootstrap: [
    { name: 'sm', width: 576, height: 480 },
    { name: 'md', width: 768, height: 1024 },
    { name: 'lg', width: 992, height: 768 },
    { name: 'xl', width: 1200, height: 800 },
    { name: 'xxl', width: 1400, height: 900 },
  ],
};
