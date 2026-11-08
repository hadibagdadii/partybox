import type { CambioAction, CambioHostView, Face } from '@partybox/cambio';
import type { Rng } from '@partybox/shared';
import type { BotStrategy } from './strategy.js';

/** Chance a bot tries a blind guess at a fresh top discard. Most guesses are wrong. */
export const GUESS_CHANCE = 0.08;
/** Chance a bot snaps a card it knows matches, because everyone saw it in a wrong snap. */
export const KNOWN_CHANCE = 0.7;
/** Chance a snap of another player's card leaves out the give card, to exercise that rejection. */
export const NO_GIVE_CHANCE = 0.05;

const roll = (rng: Rng, chance: number) => rng.int(10_000) < chance * 10_000;

/** Faces this round's host view has shown publicly for cards that went back face down. */
function publicFaces(view: CambioHostView): Map<string, Face> {
  const known = new Map<string, Face>();
  for (const e of view.log) if (e.type === 'snapFailed') known.set(e.card.cardId, e.card.face);
  return known;
}

/**
 * A snap built only from what the TV shows: a slot id, its card id, and for another player's
 * card one of the bot's own slots to give. The bot acts on the view it saw, so by the time it
 * fires the card may have moved, and the server rejects it as too late.
 */
export function planSnap(view: CambioHostView, botId: string, rng: Rng): CambioAction | null {
  if (view.phase !== 'play' || !view.topDiscard) return null;
  const me = view.players.find((p) => p.id === botId);
  if (!me) return null;
  const top = view.topDiscard.face.rank;
  const known = publicFaces(view);

  const all = view.players.flatMap((p) => p.slots.map((slot) => ({ ownerId: p.id, ...slot })));
  const sure = all.filter((s) => known.get(s.cardId)?.rank === top);
  let target: (typeof all)[number] | undefined;
  if (sure.length > 0 && roll(rng, KNOWN_CHANCE)) target = sure[rng.int(sure.length)];
  else if (all.length > 0 && roll(rng, GUESS_CHANCE)) target = all[rng.int(all.length)];
  if (!target) return null;

  const snap = { type: 'snap', slotId: target.slotId, cardId: target.cardId } as const;
  if (target.ownerId === botId || me.slots.length === 0 || roll(rng, NO_GIVE_CHANCE)) return snap;
  return { ...snap, giveSlotId: me.slots[rng.int(me.slots.length)]!.slotId };
}

export const cambioBot: BotStrategy = {
  isTurnAction: (action) => (action as CambioAction).type !== 'snap',
  reflex(hostView, botId, rng) {
    const view = hostView as CambioHostView | null;
    if (!view || view.phase !== 'play' || !view.topDiscard) return null;
    return { key: `${view.round}:${view.topDiscard.cardId}`, action: planSnap(view, botId, rng) };
  },
};
