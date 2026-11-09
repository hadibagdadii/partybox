import { cardValue, theme, type Face } from '@partybox/cambio';
import { buildFixture, type Fixture, type FixtureId } from '@partybox/cambio/fixtures';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { Card } from '../cards/Card';
import { CambioTable } from '../motion/CambioTable';
import { endStateOf, useFixtureReplay } from '../motion/useFixtureReplay';
import { colors } from '../tokens';

/** Seats at the tutorial table: the smallest the fixture scripts all run on. */
export const TUTORIAL_SEATS = 5;
/** How long a finished clip holds before the next one starts. */
export const CLIP_HOLD_MS = 1600;

const VALUE_CARDS: Face[] = [
  { rank: 'joker', suit: null },
  { rank: 'K', suit: 'hearts' },
  { rank: 'A', suit: 'spades' },
  { rank: '5', suit: 'diamonds' },
  { rank: 'J', suit: 'clubs' },
  { rank: 'Q', suit: 'hearts' },
  { rank: 'K', suit: 'spades' },
];

/** Slide 1: the real cards, face up, each with its value. Static rule art, nobody's hand. */
function Values() {
  return (
    <ul className="m-0 flex list-none items-end gap-10 p-0" data-testid="value-cards">
      {VALUE_CARDS.map((face) => (
        <li key={`${face.rank}-${face.suit}`} className="flex flex-col items-center gap-5">
          <Card face={face} faceUp size={170} />
          <span
            className="min-w-[88px] rounded-full px-5 py-1.5 text-center text-[40px] font-extrabold leading-none tabular-nums [font-stretch:112%]"
            style={{ background: 'rgba(5,24,18,.6)', color: colors.chalk }}
          >
            {theme.tutorial.value(cardValue(face))}
          </span>
        </li>
      ))}
    </ul>
  );
}

const fixtureCache = new Map<FixtureId, Fixture>();
function fixtureFor(id: FixtureId): Fixture {
  let f = fixtureCache.get(id);
  if (!f) {
    f = buildFixture(id, TUTORIAL_SEATS);
    fixtureCache.set(id, f);
  }
  return f;
}

/** One clip: the TV table and the peeker's phone, playing a real engine sequence. */
/** The initial peek clip presses and holds the hand, as a player does, then lets go. */
export const PEEK_HOLD = { from: 700, to: 3400 } as const;

function Clip({
  fixture,
  onDone,
  reduced,
}: {
  fixture: Fixture;
  onDone?: () => void;
  reduced: boolean;
}) {
  const replay = useFixtureReplay(fixture, { startDelay: 500 });
  const { host, peeker, tv, phone, done } = replay;
  const holds = fixture.id === 'peekPhase';
  const [held, setHeld] = useState(holds && reduced);
  useEffect(() => {
    if (!holds || reduced) return;
    const on = setTimeout(() => setHeld(true), PEEK_HOLD.from);
    const off = setTimeout(() => setHeld(false), PEEK_HOLD.to);
    return () => [on, off].forEach(clearTimeout);
  }, [holds, reduced]);
  const perspective = useMemo(
    () =>
      held
        ? {
            ...replay.perspective,
            handFaces: Object.fromEntries(peeker.peeks.map((p) => [p.cardId, p.face])),
          }
        : replay.perspective,
    [held, replay.perspective, peeker.peeks],
  );
  const finished = done && (!holds || reduced || !held);
  useEffect(() => {
    if (!finished || !onDone) return;
    const t = setTimeout(onDone, CLIP_HOLD_MS);
    return () => clearTimeout(t);
  }, [finished, onDone]);
  return (
    <div
      className="flex items-center gap-12"
      data-motion={finished ? 'idle' : 'busy'}
      data-held={held ? '' : undefined}
    >
      <div
        aria-hidden="true"
        className="h-[468px] w-[832px] overflow-hidden rounded-[28px] shadow-[0_2px_4px_rgba(0,0,0,.3),0_30px_60px_-24px_rgba(0,0,0,.7)]"
      >
        <CambioTable view={host} frame={tv} />
      </div>
      <div
        aria-hidden="true"
        className="h-[488px] w-[252px] overflow-hidden rounded-[36px] border-[6px] border-[#0d0f10] shadow-[0_2px_4px_rgba(0,0,0,.3),0_30px_60px_-24px_rgba(0,0,0,.7)]"
      >
        <CambioTable
          view={peeker}
          frame={phone}
          perspective={perspective}
          phoneOf={fixture.peekerId}
        />
      </div>
    </div>
  );
}

interface ClipSpec {
  id: FixtureId;
  label: string;
}

/**
 * Plays clips in order and loops. With reduced motion it shows the last clip's end state and
 * stays still.
 */
function Clips({ clips }: { clips: readonly ClipSpec[] }) {
  const reduced = useReducedMotion() ?? false;
  const fixtures = useMemo(() => clips.map((c) => fixtureFor(c.id)), [clips]);
  const [run, setRun] = useState({ i: 0, epoch: 0 });
  const next = useCallback(
    () => setRun((r) => ({ i: (r.i + 1) % clips.length, epoch: r.epoch + 1 })),
    [clips.length],
  );
  const i = reduced ? clips.length - 1 : run.i;
  const fixture = reduced ? endStateOf(fixtures[i]!) : fixtures[i]!;
  return (
    <figure className="m-0 flex flex-col items-center gap-4" data-clip={clips[i]!.id}>
      <Clip
        key={`${i}:${run.epoch}:${reduced}`}
        fixture={fixture}
        onDone={reduced ? undefined : next}
        reduced={reduced}
      />
      {clips.length > 1 && (
        <figcaption>
          <ol className="m-0 flex list-none gap-3 p-0">
            {clips.map((c, n) => (
              <li
                key={c.id}
                aria-current={n === i ? 'step' : undefined}
                className="rounded-full px-5 py-1.5 text-[26px] font-semibold transition-colors duration-200 ease-out motion-reduce:transition-none"
                style={
                  n === i
                    ? { background: colors.glow, color: colors.ink }
                    : { background: 'rgba(5,24,18,.6)', color: colors.chalk }
                }
              >
                {c.label}
              </li>
            ))}
          </ol>
        </figcaption>
      )}
    </figure>
  );
}

const t = theme.tutorial;
const p = theme.powers;
const PEEK: readonly ClipSpec[] = [{ id: 'peekPhase', label: t.peekKinds.peekPhase }];
const TURN: readonly ClipSpec[] = [
  { id: 'draw', label: t.turnKinds.draw },
  { id: 'swap', label: t.turnKinds.swap },
  { id: 'discard', label: t.turnKinds.discard },
];
const POWERS: readonly ClipSpec[] = [
  { id: 'peekOwn', label: p.peekOwn.name },
  { id: 'peekOther', label: p.peekOther.name },
  { id: 'blindSwap', label: p.swapOthers.name },
  { id: 'kingSwap', label: p.peekSwap.name },
];
const SNAPS: readonly ClipSpec[] = [
  { id: 'snap', label: t.snapKinds.snap },
  { id: 'snapGive', label: t.snapKinds.snapGive },
  { id: 'wrongSnap', label: t.snapKinds.wrongSnap },
];
const CALL: readonly ClipSpec[] = [
  { id: 'call', label: t.callKinds.call },
  { id: 'reveal', label: t.callKinds.reveal },
];

/** One picture per slide, in the same order as `theme.tutorial.slides`. */
export const slideArt: readonly ComponentType[] = [
  Values,
  () => <Clips clips={PEEK} />,
  () => <Clips clips={TURN} />,
  () => <Clips clips={POWERS} />,
  () => <Clips clips={SNAPS} />,
  () => <Clips clips={CALL} />,
];
