import { cardValue } from './cards.js';
import type { Slot } from './state.js';

/** Sum of the card values; an empty hand scores 0. */
export const scoreHand = (hand: readonly Slot[]): number =>
  hand.reduce((sum, slot) => sum + cardValue(slot.card.face), 0);

/** Ids with the lowest score, in `order`. */
function lowest(scores: Record<string, number>, order: readonly string[]): string[] {
  const min = Math.min(...order.map((id) => scores[id] ?? 0));
  return order.filter((id) => (scores[id] ?? 0) === min);
}

/**
 * Lowest score wins. If the caller ties for lowest, the tied non-callers win instead; tied
 * non-callers share the win.
 */
export function roundWinners(
  scores: Record<string, number>,
  order: readonly string[],
  callerId: string | null,
): string[] {
  const tied = lowest(scores, order);
  if (callerId !== null && tied.length > 1 && tied.includes(callerId)) {
    return tied.filter((id) => id !== callerId);
  }
  return tied;
}

/** Lowest match total wins; ties share. */
export const matchWinners = (totals: Record<string, number>, order: readonly string[]): string[] =>
  lowest(totals, order);
