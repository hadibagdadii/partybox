import type { CambioHostView, CambioPlayerView } from '@partybox/cambio';
import type { Fixture, FixtureId } from '@partybox/cambio/fixtures';
import { useEffect, useMemo, useState } from 'react';
import type { Perspective } from './CardLayer';
import { privateFaces } from './scene';
import { useCambioMotion, type MotionFrame, type MotionOptions } from './useCambioMotion';

/** Time between a fixture's broadcasts: bursts arrive like fast bots, peeks hold to be seen. */
export const gapFor = (id: FixtureId) => (id === 'burst' ? 25 : id.startsWith('peek') ? 1400 : 900);

export interface FixtureReplay {
  host: CambioHostView;
  peeker: CambioPlayerView;
  /** Motion for the TV table and for the peeker's phone. */
  tv: MotionFrame;
  phone: MotionFrame;
  perspective: Perspective;
  /** Every broadcast has arrived and both screens have finished moving. */
  done: boolean;
}

/**
 * Plays a fixture's broadcasts, one every `gapFor(id)`, into a TV and the peeker's phone, through
 * the same motion hook the game uses. Mount it fresh (a new `key`) to replay. The gallery and the
 * tutorial both use it.
 */
export function useFixtureReplay(
  fixture: Fixture,
  opts: MotionOptions & { startDelay?: number } = {},
): FixtureReplay {
  const timeScale = opts.timeScale ?? 1;
  const [host, setHost] = useState<CambioHostView>(fixture.before.host);
  const [peeker, setPeeker] = useState<CambioPlayerView>(fixture.before.peeker);
  const [arrived, setArrived] = useState(fixture.steps.length === 0);
  const motionOpts = { timeScale, reduced: opts.reduced };
  const tv = useCambioMotion(host, motionOpts);
  const phone = useCambioMotion(peeker, motionOpts);

  useEffect(() => {
    if (!fixture.steps.length) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = (opts.startDelay ?? 300) * timeScale;
    fixture.steps.forEach((s, i) => {
      timers.push(
        setTimeout(() => {
          setHost(s.host);
          setPeeker(s.peeker);
          if (i === fixture.steps.length - 1) setArrived(true);
        }, at),
      );
      at += gapFor(fixture.id) * timeScale;
    });
    return () => timers.forEach(clearTimeout);
    // A new fixture remounts the caller; this runs once per replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const perspective = useMemo(
    () => ({ youId: fixture.peekerId, privateFaces: privateFaces(peeker) }),
    [fixture.peekerId, peeker],
  );
  const idle = (f: MotionFrame) => !f.playing && f.backlog === 0 && f.pending === 0;
  return { host, peeker, tv, phone, perspective, done: arrived && idle(tv) && idle(phone) };
}

/** A fixture that starts at its own last broadcast: the end state, with nothing to play. */
export function endStateOf(fixture: Fixture): Fixture {
  const last = fixture.steps.at(-1);
  if (!last) return fixture;
  return { ...fixture, before: { host: last.host, peeker: last.peeker }, steps: [] };
}
