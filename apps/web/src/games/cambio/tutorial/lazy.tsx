import { lazy, Suspense } from 'react';
import type { HostScreenProps } from '../../registry';

// The TV's slides run the engine to build their fixtures, so they load only when a tutorial
// starts: never on the landing page or in a game.
const Tv = lazy(() => import('./TutorialTv').then((m) => ({ default: m.TutorialTv })));

export function CambioTutorialTv(props: HostScreenProps) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-[#07130f]" />}>
      <Tv {...props} />
    </Suspense>
  );
}
