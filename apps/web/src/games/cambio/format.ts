import { theme, type CambioHostView, type NameOf } from '@partybox/cambio';

export function nameLookup(view: Pick<CambioHostView, 'players'>): NameOf {
  const byId = new Map(view.players.map((p) => [p.id, p.name]));
  return (id) => byId.get(id) ?? '?';
}

/** "Amina #2": a slot by its owner and 1-based position in their hand. */
export function slotLookup(view: Pick<CambioHostView, 'players'>, youId?: string) {
  const bySlot = new Map<string, string>();
  for (const p of view.players) {
    p.slots.forEach((s, i) =>
      bySlot.set(s.slotId, `${p.id === youId ? 'Your' : p.name} #${i + 1}`),
    );
  }
  return (slotId: string) => bySlot.get(slotId) ?? '?';
}

export const optionSummary = (o: CambioHostView['options']): string =>
  [
    o.scoringMode === 'match'
      ? `${theme.scoringModes.match.name} to ${o.matchTarget}`
      : theme.scoringModes.single.name,
    o.lockCaller && theme.options.lockCaller.label,
    o.rememberPeeks && theme.options.rememberPeeks.label,
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * Turns left after Cambio: everyone from the current player up to (not including) the caller.
 * Zero when nobody has called or the round is not in play.
 */
export function turnsLeft(view: Pick<CambioHostView, 'players' | 'turn' | 'callerId'>): number {
  if (!view.callerId || !view.turn) return 0;
  const order = view.players.map((p) => p.id);
  const caller = order.indexOf(view.callerId);
  const current = order.indexOf(view.turn.playerId);
  if (caller < 0 || current < 0) return 0;
  return (caller - current + order.length) % order.length;
}
