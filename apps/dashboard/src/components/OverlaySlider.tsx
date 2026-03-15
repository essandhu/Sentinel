import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

interface OverlaySliderProps {
  beforeUrl: string;
  afterUrl: string;
}

export function OverlaySlider({ beforeUrl, afterUrl }: OverlaySliderProps) {
  return (
    <div className="overflow-hidden rounded" style={{ border: '1px solid var(--s-border)' }}>
      <ReactCompareSlider
        itemOne={<ReactCompareSliderImage src={beforeUrl} alt="Before" />}
        itemTwo={<ReactCompareSliderImage src={afterUrl} alt="After" />}
      />
    </div>
  );
}
