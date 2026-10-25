import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

function fit(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H) || 1;
}

const ScaleContext = createContext(1);

/** Current stage scale, for converting screen-space rects back to stage pixels. */
export function useStageScale(): number {
  return useContext(ScaleContext);
}

/**
 * A fixed 1920×1080 stage scaled to fit the viewport and letterboxed, so the TV
 * lays out identically at 720p and 1080p and never scrolls. Sizes inside are
 * "px at 1080p".
 */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(fit);
  useEffect(() => {
    const onResize = () => setScale(fit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return (
    <div className="no-select fixed inset-0 overflow-hidden bg-court-night">
      <div
        data-testid="tv-stage"
        className="absolute left-1/2 top-1/2 overflow-hidden bg-court-night text-court-parchment"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <ScaleContext.Provider value={scale}>{children}</ScaleContext.Provider>
      </div>
    </div>
  );
}
