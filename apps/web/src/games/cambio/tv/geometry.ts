import type { CambioHostView } from '@partybox/cambio';
import { handCols, type Box, type TableLayout } from '../motion/layout';
import type { Scene } from '../motion/scene';
import { CARD_RATIO } from '../tokens';

/** Where a seat's cards actually sit now (its grid at its current width), or null if empty. */
export function handBox(layout: TableLayout, seat: Scene['seats'][number]): Box | null {
  if (!seat.slots.length) return null;
  const cols = handCols(seat.slots.map((s) => s.pos));
  const rows = [0, 1];
  const xs: number[] = [];
  const ys: number[] = [];
  let w = 0;
  for (let col = 0; col < cols; col++) {
    for (const row of rows) {
      const pos = col < 2 ? row * 2 + col : 4 + (col - 2) * 2 + row;
      const p = layout.slot(seat.playerId, pos, cols);
      w = p.scale * layout.spriteWidth;
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  const h = w * CARD_RATIO;
  const x = Math.min(...xs) - w / 2;
  const y = Math.min(...ys) - h / 2;
  return { x, y, w: Math.max(...xs) + w / 2 - x, h: Math.max(...ys) + h / 2 - y };
}

/**
 * Only the public projection, whatever the TV is handed. A player's view carries their drawn
 * card, peeks, and remembered cards; none of it may reach the screen everyone can see.
 */
export function publicOnly(game: CambioHostView): CambioHostView {
  return {
    phase: game.phase,
    round: game.round,
    options: game.options,
    players: game.players,
    deckCount: game.deckCount,
    discardCount: game.discardCount,
    topDiscard: game.topDiscard,
    turn: game.turn,
    callerId: game.callerId,
    lockedPlayerId: game.lockedPlayerId,
    readyIds: game.readyIds,
    waitingOn: game.waitingOn,
    totals: game.totals,
    lastRound: game.lastRound,
    winners: game.winners,
    log: game.log,
  };
}

/** The leaders (lowest total, ties shared) and who is closest to the target (highest total). */
export function matchLeaders(
  totals: Record<string, number>,
  seatIds: readonly string[],
): { leaders: string[]; closest: string | null } {
  if (!seatIds.length) return { leaders: [], closest: null };
  const t = (id: string) => totals[id] ?? 0;
  const low = Math.min(...seatIds.map(t));
  const high = Math.max(...seatIds.map(t));
  return {
    leaders: seatIds.filter((id) => t(id) === low),
    closest: seatIds.find((id) => t(id) === high) ?? null,
  };
}
