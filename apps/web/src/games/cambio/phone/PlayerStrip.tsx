import { theme, type CambioPlayerView } from '@partybox/cambio';
import type { PhoneLayout } from '../motion/layout';
import { colors } from '../tokens';
import { LockIcon } from './ui';

/** Opaque: the other players' cards rest tucked under their chip and must not show through. */
const CHIP_BG = '#082a20';

/**
 * The other players as compact chips along the top: name, card count, a ring on whoever's turn
 * it is, and a lock once the caller's cards are locked. Their cards rest tucked under the chips.
 */
export function PlayerStrip({ view, layout }: { view: CambioPlayerView; layout: PhoneLayout }) {
  const me = view.you?.id;
  const { chipW, chipH } = layout.regions.strip;
  const ready = new Set(view.readyIds);
  return (
    <ul
      aria-label="Players"
      className="pointer-events-none absolute inset-0 z-[90] m-0 list-none p-0"
    >
      {view.players
        .filter((p) => p.id !== me)
        .map((p) => {
          const seat = layout.seats.find((s) => s.playerId === p.id);
          if (!seat) return null;
          const turn = view.phase === 'play' && view.turn?.playerId === p.id;
          const locked = view.lockedPlayerId === p.id;
          const caller = view.callerId === p.id;
          const waiting = view.phase === 'peek' && !ready.has(p.id);
          return (
            <li
              key={p.id}
              data-testid={`chip-${p.id}`}
              data-turn={turn ? '' : undefined}
              className="absolute flex flex-col items-center justify-center rounded-[12px] px-1.5 font-card leading-tight"
              style={{
                left: seat.labelX - chipW / 2,
                top: seat.labelY - chipH / 2,
                width: chipW,
                height: chipH,
                color: turn ? colors.ink : colors.chalk,
                background: turn ? colors.glow : CHIP_BG,
                boxShadow: caller
                  ? `0 0 0 2px ${colors.glow}, 0 4px 10px -4px rgba(0,0,0,.6)`
                  : '0 0 0 1px rgba(233,239,233,.12), 0 4px 10px -4px rgba(0,0,0,.6)',
                opacity: waiting ? 0.7 : 1,
                transition: 'background-color 200ms ease, color 200ms ease',
              }}
            >
              <span className="flex w-full min-w-0 items-center justify-center gap-1 text-[13px] font-semibold">
                <span className="truncate">{p.name}</span>
                {locked && (
                  <span
                    aria-label={theme.phone.locked}
                    className="shrink-0"
                    style={{ color: turn ? colors.ink : colors.glow }}
                  >
                    <LockIcon />
                  </span>
                )}
              </span>
              <span className="text-[11px] tabular-nums opacity-80">
                {theme.phone.cardCount(p.slots.length)}
              </span>
            </li>
          );
        })}
    </ul>
  );
}
