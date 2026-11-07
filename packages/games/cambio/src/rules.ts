import type { PowerId } from './ids.js';
import type { CambioPlayer, CambioState, Slot } from './state.js';

export interface Located {
  owner: CambioPlayer;
  slot: Slot;
  index: number;
}

export function findSlot(s: CambioState, slotId: string): Located | null {
  for (const owner of s.players) {
    const index = owner.hand.findIndex((slot) => slot.id === slotId);
    if (index !== -1) return { owner, slot: owner.hand[index] as Slot, index };
  }
  return null;
}

export const playerById = (s: CambioState, id: string): CambioPlayer | undefined =>
  s.players.find((p) => p.id === id);

/** The caller, when lockCaller protects their cards. */
export const lockedPlayerId = (s: CambioState): string | null =>
  s.options.lockCaller ? s.callerId : null;

export const topDiscard = (s: CambioState) => s.discard[s.discard.length - 1] ?? null;

/** Whether every player has finished a turn, which unlocks calling Cambio. */
export const everyoneHasPlayed = (s: CambioState): boolean =>
  s.players.every((p) => (s.completedTurns[p.id] ?? 0) >= 1);

/** Whether `playerId` may call Cambio right now. */
export function canCall(s: CambioState, playerId: string): boolean {
  return (
    s.phase === 'play' &&
    s.turn?.playerId === playerId &&
    s.turn.stage === 'start' &&
    s.callerId === null &&
    everyoneHasPlayed(s)
  );
}

export type PeekPower = 'peekOwn' | 'peekOther' | 'peekSwap';
export type SwapPower = 'swapOthers' | 'swapAny';

export const isPeekPower = (p: PowerId | null): p is PeekPower =>
  p === 'peekOwn' || p === 'peekOther' || p === 'peekSwap';
export const isSwapPower = (p: PowerId | null): p is SwapPower =>
  p === 'swapOthers' || p === 'swapAny';

/** Slots `actorId` may peek at with `power`. Peeking at the caller's cards is always allowed. */
export function peekTargets(s: CambioState, actorId: string, power: PeekPower): Located[] {
  return allSlots(s).filter(({ owner }) =>
    power === 'peekOwn'
      ? owner.id === actorId
      : power === 'peekOther'
        ? owner.id !== actorId
        : true,
  );
}

/** Players whose cards a swap power may move. */
function swappablePlayers(s: CambioState, actorId: string, power: SwapPower): CambioPlayer[] {
  const locked = lockedPlayerId(s);
  return s.players.filter(
    (p) => p.id !== locked && (power === 'swapAny' || p.id !== actorId) && p.hand.length > 0,
  );
}

/** Whether `a` and `b` are a legal blind swap for `power`: two different eligible players. */
export function isLegalSwap(
  s: CambioState,
  actorId: string,
  power: SwapPower,
  a: Located,
  b: Located,
): boolean {
  if (a.owner.id === b.owner.id) return false;
  const ok = new Set(swappablePlayers(s, actorId, power).map((p) => p.id));
  return ok.has(a.owner.id) && ok.has(b.owner.id);
}

/** Every unordered pair of slots a blind swap may exchange. */
export function swapPairs(s: CambioState, actorId: string, power: SwapPower): [string, string][] {
  const players = swappablePlayers(s, actorId, power);
  const pairs: [string, string][] = [];
  players.forEach((p, i) => {
    for (const q of players.slice(i + 1)) {
      for (const a of p.hand) for (const b of q.hand) pairs.push([a.id, b.id]);
    }
  });
  return pairs;
}

/** Whether the peeked card is still where the black King saw it. */
export function peekStillValid(s: CambioState): Located | null {
  const peek = s.turn?.peek;
  if (!peek) return null;
  const at = findSlot(s, peek.slotId);
  return at && at.slot.card.id === peek.cardId && at.owner.id === peek.playerId ? at : null;
}

/** Slots the black King's peeked card may swap with: a different, unlocked player's. */
export function kingSwapTargets(s: CambioState): Located[] {
  const peeked = peekStillValid(s);
  const locked = lockedPlayerId(s);
  if (!peeked || peeked.owner.id === locked) return [];
  return allSlots(s).filter(({ owner }) => owner.id !== peeked.owner.id && owner.id !== locked);
}

/** Whether `power` has anything to act on, so the turn stops to let the player use it. */
export function powerUsable(s: CambioState, actorId: string, power: PowerId): boolean {
  if (isPeekPower(power)) return peekTargets(s, actorId, power).length > 0;
  return swappablePlayers(s, actorId, power).length >= 2;
}

export function allSlots(s: CambioState): Located[] {
  return s.players.flatMap((owner) => owner.hand.map((slot, index) => ({ owner, slot, index })));
}

/** Total cards in play: deck, discard, hands, and any held draw. */
export function cardCount(s: CambioState): number {
  return (
    s.deck.length +
    s.discard.length +
    s.players.reduce((n, p) => n + p.hand.length, 0) +
    (s.turn?.drawn ? 1 : 0)
  );
}
