import { UNREST_LIMIT, theme, type DecreeId, type DiwanHostView } from '@partybox/diwan';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HostScreenProps } from '../../registry';
import { trackSources, voteBadges } from '../court-record';
import { nameLookup } from '../format';
import { LatticeBackground } from '../ornaments';
import { CourtRecord } from '../ui/CourtRecord';
import { Board } from './Board';
import { useHerald } from './herald';
import { HeraldSettings } from './HeraldSettings';
import { ExileBanner } from './moments/ExileBanner';
import { GameOver } from './moments/GameOver';
import { VoteCards } from './moments/VoteCards';
import { NightScene } from './NightScene';
import { PhaseBanner } from './PhaseBanner';
import {
  BadgeAnchorContext,
  TileRow,
  awayIds,
  type BadgeAnchors,
  type TileState,
} from './PlayerTiles';
import { Stage } from './Stage';
import { useMoments, type QueuedMoment } from './useMoments';
import { useReducedMotion } from './useReducedMotion';
import { WaitingLine } from './WaitingLine';

/** How long a Riot shakes the unrest meter before its decree lands, in ms. */
export const RIOT_METER_MS = 1400;

/**
 * The Diwan TV screen. Renders only the host view, which carries no roles (until
 * the game is over), hands, or deck order.
 */
export function DiwanTv({ room, game, newRoom }: HostScreenProps) {
  const view = game as DiwanHostView;
  const name = useMemo(() => nameLookup(view.players), [view.players]);
  const reduced = useReducedMotion();
  const { current, pending } = useMoments(view.log, reduced);
  const caption = useHerald(view);
  const riotStep = useRiotStep(current, reduced);
  const anchors = useRef<BadgeAnchors>(new Map()).current;

  const away = useMemo(() => awayIds(room.players), [room.players]);
  const sources = useMemo(() => trackSources(view.log), [view.log]);
  const badges = useMemo(() => voteBadges(view.log), [view.log]);

  // Decrees and unrest lag the view until their moments play.
  const queuedAfter = pending.slice(1);
  const shown: Record<DecreeId, number> = { loyal: view.enacted.loyal, rebel: view.enacted.rebel };
  for (const m of queuedAfter) if (m.kind === 'enacted' || m.kind === 'riot') shown[m.decree]--;
  if (current?.kind === 'riot' && riotStep === 'meter') shown[current.decree]--;
  const unrest = queuedAfter.some((m) => m.kind === 'riot')
    ? UNREST_LIMIT - 1
    : current?.kind === 'riot' && riotStep === 'meter'
      ? UNREST_LIMIT
      : view.unrest;
  const revealing = pending.some((m) => m.kind === 'voteReveal');

  const stateOf = (id: string): TileState => ({
    checked:
      (view.phase === 'reveal' && view.acknowledgedIds.includes(id)) ||
      (view.phase === 'vote' && view.votedIds.includes(id)),
    vote: revealing ? null : (badges[id] ?? null),
    away: away.has(id),
    waiting: view.phase !== 'reveal' && view.phase !== 'vote' && view.waitingOn.includes(id),
    exiling: current?.kind === 'exiled' && current.targetId === id,
  });

  const half = Math.ceil(view.players.length / 2);
  const top = view.players.slice(0, half).map((p) => p.id);
  const bottom = view.players.slice(half).map((p) => p.id);

  let center;
  if (current?.kind === 'voteReveal') {
    center = (
      <VoteCards
        key={current.id}
        view={view}
        mode={{ kind: 'reveal', votes: current.votes, passed: current.passed }}
        reduced={reduced}
      />
    );
  } else if (view.phase === 'over' && !current) {
    center = <GameOver view={view} name={name} reduced={reduced} />;
  } else if (view.phase === 'reveal') {
    center = <NightScene seen={view.acknowledgedIds.length} total={view.players.length} />;
  } else if (view.phase === 'vote' && !current) {
    center = (
      <VoteCards view={view} mode={{ kind: 'voting', votedIds: view.votedIds }} reduced={reduced} />
    );
  } else {
    center = <Board view={view} sources={sources} shown={shown} unrest={unrest} moment={current} />;
  }

  return (
    <Stage>
      <BadgeAnchorContext.Provider value={anchors}>
        <LatticeBackground className="opacity-[0.06]" />
        <div className="relative flex h-full gap-8 px-10 py-5">
          <div className="flex w-[1320px] flex-none flex-col">
            <div className="h-[146px] flex-none">
              <PhaseBanner view={view} name={name} />
              <div className="mt-1 flex justify-center">
                <WaitingLine view={view} name={name} away={away} />
              </div>
            </div>
            <div className="h-[170px] flex-none">
              <TileRow view={view} ids={top} stateOf={stateOf} />
            </div>
            <div className="relative min-h-0 flex-1" data-testid="tv-center">
              {center}
              {current?.kind === 'exiled' && <ExileBanner name={name(current.targetId)} />}
            </div>
            <div className="h-[170px] flex-none">
              <TileRow view={view} ids={bottom} stateOf={stateOf} />
            </div>
            <p
              className="h-[48px] flex-none truncate text-center font-serif text-tv-sm italic text-court-goldLight"
              data-testid="caption"
              aria-live="polite"
            >
              {caption}
            </p>
          </div>
          <aside className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex items-center justify-between">
              <p
                className="font-display text-tv-lg leading-none tracking-[0.2em] text-court-gold"
                aria-label="Room code"
              >
                {room.code}
              </p>
              <HeraldSettings newRoom={newRoom} />
            </div>
            <h2 className="font-display text-tv-md text-court-goldLight">{theme.tv.courtRecord}</h2>
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <CourtRecord log={view.log} name={name} size="tv" limit={6} />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-court-night to-transparent" />
            </div>
          </aside>
        </div>
      </BadgeAnchorContext.Provider>
    </Stage>
  );
}

/** A Riot plays in two beats: the meter fills and shakes, then the decree lands. */
function useRiotStep(current: QueuedMoment | null, reduced: boolean): 'meter' | 'card' {
  const [landed, setLanded] = useState<number | null>(null);
  useEffect(() => {
    if (current?.kind !== 'riot') return;
    const t = setTimeout(() => setLanded(current.id), reduced ? RIOT_METER_MS / 2 : RIOT_METER_MS);
    return () => clearTimeout(t);
  }, [current, reduced]);
  return current?.kind === 'riot' && landed !== current.id ? 'meter' : 'card';
}
