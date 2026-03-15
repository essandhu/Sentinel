const regionBorderColors: Record<string, string> = {
  layout: 'border-purple-500 bg-purple-500/15',
  style: 'border-blue-500 bg-blue-500/15',
  content: 'border-amber-500 bg-amber-500/15',
  cosmetic: 'border-gray-400 bg-gray-400/15',
};

const regionLabelColors: Record<string, { bg: string; color: string }> = {
  layout: { bg: 'rgba(147, 51, 234, 0.85)', color: '#fff' },
  style: { bg: 'rgba(91, 156, 245, 0.85)', color: '#fff' },
  content: { bg: 'rgba(212, 160, 83, 0.85)', color: '#fff' },
  cosmetic: { bg: 'rgba(90, 95, 115, 0.85)', color: '#fff' },
};

export interface Region {
  relX: number;
  relY: number;
  relWidth: number;
  relHeight: number;
  regionCategory?: string;
  regionConfidence?: number;
  spatialZone?: string;
}

interface RegionOverlayProps {
  regions: Region[];
  visible: boolean;
  onRegionClick?: (region: Region, index: number) => void;
}

export function RegionOverlay({ regions, visible, onRegionClick }: RegionOverlayProps) {
  if (!visible) return null;

  return (
    <>
      {regions.map((region, i) => {
        const colors = regionBorderColors[region.regionCategory ?? ''] ?? 'border-gray-400 bg-gray-400/15';
        const labelStyle = regionLabelColors[region.regionCategory ?? ''] ?? { bg: 'rgba(90, 95, 115, 0.85)', color: '#fff' };
        const interactive = !!onRegionClick;

        return (
          <div
            key={i}
            data-testid="region-box"
            className={`${interactive ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'} absolute border-2 ${colors}`}
            style={{
              left: `${region.relX / 100}%`,
              top: `${region.relY / 100}%`,
              width: `${region.relWidth / 100}%`,
              height: `${region.relHeight / 100}%`,
            }}
            title={region.spatialZone ? `Zone: ${region.spatialZone}` : undefined}
            onClick={interactive ? () => onRegionClick(region, i) : undefined}
          >
            {region.regionCategory && (
              <span
                className="absolute left-0 top-0 px-1 text-[10px] font-medium leading-tight"
                style={{ background: labelStyle.bg, color: labelStyle.color }}
              >
                {region.regionCategory}
                {region.regionConfidence != null && (
                  <span className="ml-1 opacity-75">{region.regionConfidence}%</span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
