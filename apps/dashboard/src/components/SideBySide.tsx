import { useRef } from 'react';
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';

interface SideBySideProps {
  beforeUrl: string;
  afterUrl: string;
}

export function SideBySide({ beforeUrl, afterUrl }: SideBySideProps) {
  const beforeRef = useRef<ReactZoomPanPinchRef>(null);
  const afterRef = useRef<ReactZoomPanPinchRef>(null);
  const isSyncing = useRef(false);

  const syncFrom =
    (source: 'before' | 'after') =>
    (
      _ref: ReactZoomPanPinchRef,
      state: { scale: number; positionX: number; positionY: number },
    ) => {
      if (isSyncing.current) return;
      isSyncing.current = true;
      const target = source === 'before' ? afterRef : beforeRef;
      target.current?.setTransform(state.positionX, state.positionY, state.scale);
      requestAnimationFrame(() => {
        isSyncing.current = false;
      });
    };

  return (
    <div className="flex gap-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded" style={{ border: '1px solid var(--s-border)' }}>
        <p className="px-2 py-1 text-sm font-semibold" style={{ color: 'var(--s-text-primary)' }}>Before</p>
        <TransformWrapper ref={beforeRef} onTransformed={syncFrom('before')}>
          <TransformComponent>
            <img src={beforeUrl} alt="Before" className="max-w-full" />
          </TransformComponent>
        </TransformWrapper>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded" style={{ border: '1px solid var(--s-border)' }}>
        <p className="px-2 py-1 text-sm font-semibold" style={{ color: 'var(--s-text-primary)' }}>After</p>
        <TransformWrapper ref={afterRef} onTransformed={syncFrom('after')}>
          <TransformComponent>
            <img src={afterUrl} alt="After" className="max-w-full" />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
}
