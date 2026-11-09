import { buildFaces, theme } from '@partybox/cambio';
import { buildFixture, type Fixture, type FixtureId } from '@partybox/cambio/fixtures';
import { MotionConfig } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Card } from '../games/cambio/cards/Card';
import { CambioTable } from '../games/cambio/motion/CambioTable';
import { feltBackground } from '../games/cambio/motion/Felt';
import { useFixtureReplay } from '../games/cambio/motion/useFixtureReplay';
import type { CardSize } from '../games/cambio/tokens';

/** Gallery buttons: each replays a real engine sequence (or, for flip, the showcase card). */
const PRIMITIVES: { id: FixtureId | 'flip'; label: string }[] = [
  { id: 'deal', label: 'Deal' },
  { id: 'draw', label: 'Draw' },
  { id: 'flip', label: 'Flip' },
  { id: 'swap', label: 'Swap into hand' },
  { id: 'discard', label: 'Discard' },
  { id: 'peekOwn', label: 'Peek (own)' },
  { id: 'peekOther', label: 'Peek (other)' },
  { id: 'blindSwap', label: 'Blind swap' },
  { id: 'kingSwap', label: 'King swap' },
  { id: 'snap', label: 'Snap' },
  { id: 'snapGive', label: 'Snap and give' },
  { id: 'wrongSnap', label: 'Wrong snap' },
  { id: 'reshuffle', label: 'Reshuffle' },
  { id: 'call', label: 'Call Cambio' },
  { id: 'reveal', label: 'Round reveal' },
  { id: 'burst', label: 'Burst' },
  { id: 'holes', label: 'Holes and penalties' },
];

declare global {
  interface Window {
    __cambioGallery?: { replay(id: string): void; busy(): boolean; setTable(n: 6 | 12): void };
    __cambioFrames?: number[] | null;
  }
}

function Button({
  children,
  onClick,
  active,
  ...rest
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  [k: `data-${string}`]: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] min-w-[44px] rounded-full px-4 text-[15px] font-semibold transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] ${
        active
          ? 'bg-cambio-glow text-cambio-ink'
          : 'bg-white/10 text-cambio-chalk hover:bg-white/15'
      }`}
      aria-pressed={active}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Frames per second from requestAnimationFrame, plus the slowest frame in the last second. */
function FpsMeter() {
  const [stat, setStat] = useState({ fps: 0, worst: 0 });
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frames: number[] = [];
    let mark = last;
    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      frames.push(dt);
      window.__cambioFrames?.push(dt);
      if (t - mark >= 1000) {
        setStat({
          fps: Math.round((frames.length * 1000) / (t - mark)),
          worst: Math.round(Math.max(...frames)),
        });
        frames = [];
        mark = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <output
      className="rounded-full bg-black/30 px-3 py-2 text-sm text-cambio-chalk tabular-nums"
      data-testid="fps"
    >
      {stat.fps} fps · slowest {stat.worst} ms
    </output>
  );
}

/** Plays a fixture's broadcasts into a TV table and the peeker's phone. */
function Stage({
  fixture,
  timeScale,
  reduced,
  onBusy,
}: {
  fixture: Fixture;
  timeScale: number;
  reduced: boolean | undefined;
  onBusy: (b: boolean) => void;
}) {
  const { host, peeker, tv, phone, perspective, done } = useFixtureReplay(fixture, {
    timeScale,
    reduced,
  });
  useEffect(() => {
    if (fixture.steps.length) onBusy(!done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const busy = !tv.playing && tv.backlog === 0 ? '' : 'busy';
  return (
    <div className="flex flex-col gap-4 xl:flex-row" data-motion={busy || 'idle'}>
      <div className="aspect-video w-full overflow-hidden rounded-[22px] shadow-[0_2px_4px_rgba(0,0,0,.3),0_24px_48px_-24px_rgba(0,0,0,.6)] xl:flex-1">
        <CambioTable view={host} frame={tv} />
      </div>
      <figure className="flex shrink-0 flex-col items-center gap-2">
        <div className="h-[640px] w-[340px] overflow-hidden rounded-[36px] border-[6px] border-[#0d0f10] shadow-[0_2px_4px_rgba(0,0,0,.3),0_24px_48px_-24px_rgba(0,0,0,.6)]">
          <CambioTable
            view={peeker}
            frame={phone}
            perspective={perspective}
            phoneOf={fixture.peekerId}
          />
        </div>
        <figcaption className="text-sm text-cambio-chalkDim">
          {peeker.players.find((p) => p.id === fixture.peekerId)?.name}’s phone
        </figcaption>
      </figure>
      <span className="sr-only" aria-live="polite">
        {tv.playing
          ? theme.describe(
              tv.playing.step.event,
              (id) => host.players.find((p) => p.id === id)?.name ?? id,
            )
          : ''}
      </span>
      <p className="sr-only" data-testid="motion-stats">
        backlog {Math.round(tv.backlog)} collapsed {tv.collapsed}
      </p>
    </div>
  );
}

const FACES = buildFaces(1);

/** Dev-only: every Cambio card face, the back, and a replay for each motion primitive. */
export function DevCambioCards() {
  const [table, setTable] = useState<6 | 12>(6);
  const [slow, setSlow] = useState(false);
  const [reducedOn, setReducedOn] = useState(false);
  const [size, setSize] = useState<CardSize>('hand');
  const [down, setDown] = useState<Set<number>>(new Set());
  const [showcaseUp, setShowcaseUp] = useState(true);
  const [run, setRun] = useState<{ id: FixtureId; n: number; epoch: number }>({
    id: 'draw',
    n: 6,
    epoch: 0,
  });
  const busy = useRef(false);
  const cache = useRef(new Map<string, Fixture>());

  const fixture = useMemo(() => {
    const key = `${run.id}:${run.n}`;
    let f = cache.current.get(key);
    if (!f) {
      f = buildFixture(run.id, run.n);
      cache.current.set(key, f);
    }
    return f;
  }, [run.id, run.n]);

  const replay = useCallback(
    (id: string) => {
      if (id === 'flip') {
        setShowcaseUp((u) => !u);
        return;
      }
      busy.current = true;
      setRun((r) => ({ id: id as FixtureId, n: table, epoch: r.epoch + 1 }));
    },
    [table],
  );

  useEffect(() => {
    window.__cambioGallery = {
      replay,
      busy: () => busy.current,
      setTable: (n) => {
        setTable(n);
        setRun((r) => ({ ...r, n, epoch: r.epoch + 1 }));
      },
    };
    return () => {
      delete window.__cambioGallery;
    };
  }, [replay]);

  const timeScale = slow ? 4 : 1;

  return (
    <MotionConfig reducedMotion={reducedOn ? 'always' : 'user'}>
      <main
        className="min-h-dvh px-4 py-8 font-card text-cambio-chalk antialiased sm:px-8"
        style={feltBackground}
      >
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-3xl font-bold [font-stretch:112%] [text-wrap:balance]">
            {theme.title} cards and motion
          </h1>
          <FpsMeter />
        </header>

        <section aria-labelledby="table-h" className="mb-12 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="table-h" className="mr-3 text-xl font-semibold [text-wrap:balance]">
              Table
            </h2>
            {[6, 12].map((n) => (
              <Button
                key={n}
                active={table === n}
                onClick={() => {
                  setTable(n as 6 | 12);
                  setRun((r) => ({ ...r, n, epoch: r.epoch + 1 }));
                }}
              >
                {n} players
              </Button>
            ))}
            <Button active={slow} onClick={() => setSlow((s) => !s)}>
              Slow motion (¼ speed)
            </Button>
            <Button active={reducedOn} onClick={() => setReducedOn((s) => !s)}>
              Reduced motion
            </Button>
          </div>
          <div
            className="flex flex-wrap items-center gap-2"
            role="toolbar"
            aria-label="Replay an animation"
          >
            {PRIMITIVES.map((p) => (
              <Button
                key={p.id}
                onClick={() => replay(p.id)}
                active={p.id === run.id && run.epoch > 0}
                data-primitive={p.id}
              >
                {p.label}
              </Button>
            ))}
            <div className="ml-2 flex items-center gap-3">
              <Card face={FACES[11]!} faceUp={showcaseUp} size={60} flipScale={timeScale} />
            </div>
          </div>
          <Stage
            key={`${run.id}:${run.n}:${run.epoch}`}
            fixture={run.epoch === 0 ? { ...fixture, steps: [] } : fixture}
            timeScale={timeScale}
            reduced={reducedOn ? true : undefined}
            onBusy={(b) => (busy.current = b)}
          />
        </section>

        <section aria-labelledby="faces-h" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="faces-h" className="mr-3 text-xl font-semibold [text-wrap:balance]">
              Every face
            </h2>
            {(['hand', 'table', 'pile'] as const).map((s) => (
              <Button key={s} active={size === s} onClick={() => setSize(s)}>
                {s === 'hand' ? 'Phone hand' : s === 'table' ? 'TV table' : 'TV pile'}
              </Button>
            ))}
            <Button
              onClick={() => setDown((d) => (d.size ? new Set() : new Set(FACES.map((_, i) => i))))}
            >
              Flip all
            </Button>
          </div>
          <div className="flex flex-wrap gap-3" data-testid="faces">
            <figure className="flex flex-col items-center gap-1">
              <Card face={null} faceUp={false} size={size} />
              <figcaption className="text-xs text-cambio-chalkDim">Back</figcaption>
            </figure>
            {FACES.map((face, i) => (
              <button
                key={i}
                type="button"
                className="rounded-[8px] transition-transform duration-150 ease-out active:scale-[0.97]"
                onClick={() =>
                  setDown((d) => {
                    const next = new Set(d);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
                aria-label={`Flip the ${theme.cardName(face)}`}
              >
                <Card face={face} faceUp={!down.has(i)} size={size} />
              </button>
            ))}
          </div>
        </section>
      </main>
    </MotionConfig>
  );
}
