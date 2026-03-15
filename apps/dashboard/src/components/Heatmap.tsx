import { useRef, useEffect } from 'react';

interface HeatmapProps {
  diffUrl: string;
}

export function Heatmap({ diffUrl }: HeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const px = imageData.data;

      for (let i = 0; i < px.length; i += 4) {
        const r = px[i];
        if (r > px[i + 1] * 2) {
          // Changed pixel: yellow (low diff) to red (high diff) gradient
          const intensity = r / 255; // 0 = low diff, 1 = high diff
          px[i] = Math.round(255 * intensity);             // red scales with intensity
          px[i + 1] = Math.round(255 * (1 - intensity));   // green fades with intensity
          px[i + 2] = 0;                                   // no blue
        } else {
          // Unchanged pixel: dim to 30%
          px[i] = Math.round(px[i] * 0.3);
          px[i + 1] = Math.round(px[i + 1] * 0.3);
          px[i + 2] = Math.round(px[i + 2] * 0.3);
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };

    img.src = diffUrl;
  }, [diffUrl]);

  return <canvas ref={canvasRef} className="max-w-full" />;
}
