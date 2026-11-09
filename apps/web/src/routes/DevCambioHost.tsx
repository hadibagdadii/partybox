import type { CambioHostView } from '@partybox/cambio';
import { buildFixture, type FixtureId } from '@partybox/cambio/fixtures';
import type { LobbyView } from '@partybox/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CambioTv } from '../games/cambio/tv/CambioTv';

/** Every phase and big moment, each replayed from a real engine sequence. */
const SCENES: { id: FixtureId; label: string; still?: boolean }[] = [
  { id: 'peekPhase', label: 'Initial peek' },
  { id: 'draw', label: 'Idle play', still: true },
  { id: 'deal', label: 'Deal (next round)' },
  { id: 'draw', label: 'Draw' },
  { id: 'swap', label: 'Swap into hand' },
  { id: 'discard', label: 'Discard' },
  { id: 'peekOwn', label: 'Peek (own)' },
  { id: 'peekOther', label: 'Peek (other)' },
  { id: 'blindSwap', label: 'Blind swap' },
  { id: 'kingSwap', label: 'King peek and swap' },
  { id: 'snap', label: 'Snap' },
  { id: 'snapGive', label: 'Snap and give' },
  { id: 'chain', label: 'Chained snaps' },
  { id: 'wrongSnap', label: 'Wrong snap (own)' },
  { id: 'wrongSnapOther', label: 'Wrong snap (other)' },
  { id: 'reshuffle', label: 'Reshuffle' },
  { id: 'lockedCall', label: 'Cambio called, caller locked' },
  { id: 'call', label: 'Cambio called' },
  { id: 'reveal', label: 'Round end' },
  { id: 'matchRoundEnd', label: 'Match round end' },
  { id: 'gameOver', label: 'Game over' },
  { id: 'holes', label: 'Holes and penalties' },
];

/** Time between a fixture's broadcasts: peeks hold to be seen, snaps chain quickly. */
const gapFor = (id: FixtureId) =>
  id === 'chain' ? 450 : id.startsWith('peek') && id !== 'peekPhase' ? 1600 : 1100;

/** How long the "before" view shows before the moment plays. */
const BEFORE_MS = 1000;

function fixtureRoom(view: CambioHostView): LobbyView {
  return {
    code: 'CMBO',
    gameId: 'cambio',
    gameName: 'Cambio',
    minPlayers: 2,
    maxPlayers: 12,
    phase: view.phase === 'over' ? 'over' : 'playing',
    players: view.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      connected: true,
      isVip: i === 0,
      isBot: false,
      awayLong: false,
    })),
    tutorial: null,
    options: { ...view.options },
  };
}

const slowmo = () => {
  const n = Number(new URLSearchParams(location.search).get('slowmo'));
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : 1;
};

/**
 * Dev-only: the Cambio TV from engine fixtures, one scene per phase and big moment, on a 6 or
 * 12 seat table. Each scene shows its "before" view, then plays; press R to replay.
 * `?slowmo=N` slows the gallery's broadcasts and the TV's motion alike.
 */
export function DevCambioHost() {
  const [params] = useSearchParams();
  const raw = params.get('scene');
  const index = raw === null ? NaN : Number(raw);
  const n = params.get('n') === '12' ? 12 : 6;
  const scene = Number.isInteger(index) ? SCENES[index] : undefined;
  const [run, setRun] = useState(0);
  const fixture = useMemo(() => (scene ? buildFixture(scene.id, n) : null), [scene, n]);
  const [view, setView] = useState<CambioHostView | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key.toLowerCase() === 'r' && setRun((r) => r + 1);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!fixture || !scene) return;
    const k = slowmo();
    setDone(false);
    if (scene.still) {
      setView(fixture.before.host);
      setDone(true);
      return;
    }
    setView(fixture.before.host);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = BEFORE_MS * k;
    fixture.steps.forEach((s, i) => {
      timers.push(
        setTimeout(() => {
          setView(s.host);
          if (i === fixture.steps.length - 1) setDone(true);
        }, at),
      );
      at += gapFor(fixture.id) * k;
    });
    return () => timers.forEach(clearTimeout);
  }, [fixture, scene, run]);

  if (!scene || !fixture || !view) {
    return (
      <main className="min-h-dvh bg-cambio-feltEdge px-6 py-8 font-card text-cambio-chalk">
        <h1 className="text-3xl font-bold">Cambio TV scenes</h1>
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          {[6, 12].map((count) => (
            <section key={count} className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-cambio-chalkDim">{count} players</h2>
              {SCENES.map((s, i) => (
                <Link
                  key={i}
                  to={`?scene=${i}&n=${count}`}
                  className="flex min-h-[44px] items-center rounded-full bg-white/10 px-4 text-lg hover:bg-white/15"
                >
                  {s.label}
                </Link>
              ))}
            </section>
          ))}
        </div>
      </main>
    );
  }

  return (
    <div data-gallery-done={done ? '' : undefined}>
      <CambioTv key={`${index}:${n}:${run}`} room={fixtureRoom(view)} game={view} />
    </div>
  );
}
