import type { ReactNode } from 'react';
import { Stage as SharedStage } from '../../../components/Stage';

export { STAGE_H, STAGE_W, useStageScale } from '../../../components/Stage';

/** The court's TV stage: the shared 1920×1080 stage in night and parchment. */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <SharedStage className="bg-court-night text-court-parchment" outerClassName="bg-court-night">
      {children}
    </SharedStage>
  );
}
