import { cardValue, type Face } from '@partybox/cambio';

/**
 * The order hands turn over at the end of a round: around the table starting with the seat after
 * the caller, so the caller's hand comes last. With no caller, from the first seat.
 */
export function revealOrder(seatIds: readonly string[], callerId: string | null): string[] {
  const at = callerId === null ? -1 : seatIds.indexOf(callerId);
  if (at < 0) return [...seatIds];
  return [...seatIds.slice(at + 1), ...seatIds.slice(0, at + 1)];
}

/** A hand's running total as each card turns over: one entry per card, ending on its score. */
export function tallySteps(faces: readonly Face[]): number[] {
  let total = 0;
  return faces.map((f) => (total += cardValue(f)));
}

/** Gap between cards of one hand turning over, so its total visibly counts up. */
export const cardStaggerFor = (seatStagger: number) => Math.min(150, seatStagger / 5);
