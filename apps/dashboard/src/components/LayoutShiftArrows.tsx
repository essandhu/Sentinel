export interface LayoutShiftArrowData {
  baselineX: number;
  baselineY: number;
  baselineWidth: number;
  baselineHeight: number;
  currentX: number;
  currentY: number;
  currentWidth: number;
  currentHeight: number;
  magnitude: number;
  selector: string;
}

interface LayoutShiftArrowsProps {
  shifts: LayoutShiftArrowData[];
  imageWidth: number;
  imageHeight: number;
  visible: boolean;
}

const REGRESSION_THRESHOLD = 20;

export function LayoutShiftArrows({ shifts, imageWidth, imageHeight, visible }: LayoutShiftArrowsProps) {
  if (!visible || shifts.length === 0 || imageWidth === 0 || imageHeight === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-testid="layout-shift-arrows"
    >
      <defs>
        <marker
          id="shift-arrowhead"
          markerWidth="6"
          markerHeight="4"
          refX="5"
          refY="2"
          orient="auto"
        >
          <polygon points="0 0, 6 2, 0 4" fill="currentColor" />
        </marker>
        <marker
          id="shift-arrowhead-red"
          markerWidth="6"
          markerHeight="4"
          refX="5"
          refY="2"
          orient="auto"
        >
          <polygon points="0 0, 6 2, 0 4" fill="#dc2626" />
        </marker>
        <marker
          id="shift-arrowhead-orange"
          markerWidth="6"
          markerHeight="4"
          refX="5"
          refY="2"
          orient="auto"
        >
          <polygon points="0 0, 6 2, 0 4" fill="#ea580c" />
        </marker>
      </defs>
      {shifts.map((shift, i) => {
        const x1 = ((shift.baselineX + shift.baselineWidth / 2) / imageWidth) * 100;
        const y1 = ((shift.baselineY + shift.baselineHeight / 2) / imageHeight) * 100;
        const x2 = ((shift.currentX + shift.currentWidth / 2) / imageWidth) * 100;
        const y2 = ((shift.currentY + shift.currentHeight / 2) / imageHeight) * 100;
        const isRegression = shift.magnitude >= REGRESSION_THRESHOLD;
        const color = isRegression ? '#dc2626' : '#ea580c';
        const markerId = isRegression ? 'shift-arrowhead-red' : 'shift-arrowhead-orange';

        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth="0.3"
            markerEnd={`url(#${markerId})`}
          >
            <title>{`${shift.selector}: ${shift.magnitude}px`}</title>
          </line>
        );
      })}
    </svg>
  );
}
