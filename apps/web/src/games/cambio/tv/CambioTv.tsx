import { theme, type CambioHostView } from '@partybox/cambio';
import { useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import { STAGE_H, STAGE_W, Stage } from '../../../components/Stage';
import type { HostScreenProps } from '../../registry';
import { nameLookup, optionSummary } from '../format';
import { CambioTable } from '../motion/CambioTable';
import { devMotion } from '../motion/dev-motion';
import { feltBackground } from '../motion/Felt';
import { tableLayout, type TvLayout } from '../motion/layout';
import { useCambioMotion } from '../motion/useCambioMotion';
import { PeekMarker } from '../phone/PeekMarker';
import { colors } from '../tokens';
import { CambioCall, DeckLabel, SnapCallout, WrongSnapCallout } from './Callouts';
import { CambioSettings } from './CambioSettings';
import { publicOnly } from './geometry';
import { useCambioHerald } from './herald';
import { SeatGlows, SeatPlates } from './Seats';
import { useCardSounds } from './sound';
import { Standings } from './Standings';
import { Ticker } from './Ticker';
import { useRevealTally } from './useRevealTally';

/** Time between hands turning over at the round's end: slow enough for a room to follow. */
export const TV_REVEAL_STAGGER = 650;

const TV_MOTION = { ...devMotion(), revealStagger: TV_REVEAL_STAGGER };

/** The oval table: felt inside a dark wooden rail with a thin brass inlay. */
function Table({ layout }: { layout: TvLayout }) {
  const { cx, cy, rx, ry } = layout.felt;
  return (
    <div
      aria-hidden="true"
      className="absolute"
      style={{
        left: cx - rx,
        top: cy - ry,
        width: rx * 2,
        height: ry * 2,
        borderRadius: '50%',
        ...feltBackground,
        boxShadow: [
          'inset 0 0 0 2px rgba(0,0,0,.35)',
          'inset 0 10px 60px rgba(0,0,0,.45)',
          `0 0 0 20px ${colors.rail}`,
          '0 0 0 23px rgba(199,160,71,.32)',
          '0 50px 100px -30px rgba(0,0,0,.85)',
        ].join(', '),
      }}
    />
  );
}

/**
 * The Cambio TV: an oval table seen from above with every seat around it, the deck and discard
 * big in the middle, and every move animated from public events. It draws only the host view:
 * a face shows only when everyone has seen it (the discard, a wrong snap, the round's reveal).
 */
export function CambioTv({ room, game, newRoom, endGame }: HostScreenProps) {
  const view = useMemo(() => publicOnly(game as CambioHostView), [game]);
  const reduced = useReducedMotion() ?? false;
  const frame = useCambioMotion(view, TV_MOTION);
  const name = useMemo(() => nameLookup(view), [view]);
  const ids = useMemo(() => view.players.map((p) => p.id), [view.players]);
  const layout = useMemo(() => tableLayout(STAGE_W, STAGE_H, ids), [ids]);
  const caption = useCambioHerald(view);
  useCardSounds(frame);
  const tally = useRevealTally(view, frame);

  const between = view.phase === 'roundOver' || view.phase === 'over';
  const result = between && view.lastRound?.round === view.round ? view.lastRound : null;
  const settled = !frame.playing && frame.pending === 0;
  const showStandings = !!result && settled;
  const winners = useMemo(
    () => new Set(showStandings ? (view.winners ?? result?.winners ?? []) : []),
    [showStandings, view.winners, result],
  );
  const turnId = view.phase === 'play' ? (view.turn?.playerId ?? null) : null;
  const away = useMemo(
    () => new Set(room.players.filter((p) => !p.connected).map((p) => p.id)),
    [room.players],
  );

  const status =
    view.phase === 'peek'
      ? `${theme.tv.peekPhase} · ${view.readyIds.length}/${view.players.length}`
      : `${theme.tv.round} ${view.round} · ${optionSummary(view.options)}`;

  return (
    <Stage className="bg-[#07130f] text-cambio-chalk antialiased" outerClassName="bg-black">
      <div
        data-testid="cambio-tv"
        data-step={frame.playing?.step.kind ?? 'idle'}
        data-drawn={frame.scene.drawn ? '1' : undefined}
        className="absolute inset-0 font-card"
        style={{
          background:
            'radial-gradient(ellipse 75% 70% at 50% 52%, #0f2a20 0%, #07130f 70%, #040b08 100%)',
        }}
      >
        <Table layout={layout} />
        <div className="absolute inset-0">
          <CambioTable
            view={view}
            frame={frame}
            layout={layout}
            plates={false}
            bare
            under={
              <>
                <SeatGlows
                  layout={layout}
                  frame={frame}
                  turnId={turnId}
                  winners={winners}
                  reduced={reduced}
                />
                <DeckLabel layout={layout} frame={frame} reduced={reduced} />
              </>
            }
            over={
              <>
                <SeatPlates
                  layout={layout}
                  view={view}
                  frame={frame}
                  turnId={turnId}
                  winners={winners}
                  away={away}
                  tally={tally}
                />
                <PeekMarker
                  players={view.players}
                  viewerId={null}
                  layout={layout}
                  frame={frame}
                  size="tv"
                />
                <SnapCallout layout={layout} frame={frame} name={name} reduced={reduced} />
                <WrongSnapCallout layout={layout} frame={frame} name={name} reduced={reduced} />
                <CambioCall
                  layout={layout}
                  frame={frame}
                  view={view}
                  name={name}
                  reduced={reduced}
                />
              </>
            }
          />
        </div>

        <header
          className="absolute inset-x-0 top-0 flex items-center justify-between px-10"
          style={{ height: layout.bands.top }}
        >
          <div className="flex min-w-0 items-baseline gap-6">
            <p
              aria-label={theme.tv.roomCode}
              className="font-extrabold leading-none tracking-[0.14em] [font-stretch:115%]"
              style={{ fontSize: 50, color: colors.brassLight }}
            >
              {room.code}
            </p>
            {!view.callerId && (
              <p className="truncate" style={{ fontSize: 24, color: colors.chalkDim }}>
                {status}
              </p>
            )}
          </div>
          <CambioSettings newRoom={newRoom} endGame={endGame} />
        </header>

        <footer
          className="absolute inset-x-0 bottom-0 grid grid-cols-[3fr_2fr] items-end gap-10 px-10 pb-3"
          style={{ height: layout.bands.bottom }}
        >
          <Ticker view={view} pending={frame.pending} name={name} reduced={reduced} />
          <p
            data-testid="caption"
            aria-live="polite"
            className="truncate text-right font-medium [font-stretch:92%]"
            style={{ fontSize: 26, color: colors.brassLight }}
          >
            {caption}
          </p>
        </footer>

        {showStandings && result && (
          <Standings view={view} result={result} name={name} reduced={reduced} />
        )}
      </div>
    </Stage>
  );
}
