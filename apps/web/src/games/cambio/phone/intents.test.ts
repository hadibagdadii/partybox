import { buildFixture } from '@partybox/cambio/fixtures';
import { describe, expect, it } from 'vitest';
import { blindFirsts, blindPair, blindSeconds, intentsOf, turnsLeft } from './intents';

describe('intentsOf reads only legalActions', () => {
  it('offers Draw at the start of your turn, and nothing for a player not seated', () => {
    const v = buildFixture('draw', 6).before.peeker;
    const i = intentsOf(v);
    expect(i.draw).toBe(true);
    expect(i.discard).toBe(false);
    expect(intentsOf({ ...v, legalActions: [] }).draw).toBe(false);
  });

  it('holding a drawn card: swap into any of your slots, or discard', () => {
    const v = buildFixture('swap', 6).before.peeker;
    const i = intentsOf(v);
    const mine = v.players.find((p) => p.id === v.you!.id)!.slots.map((s) => s.slotId);
    expect([...i.swap].sort()).toEqual([...mine].sort());
    expect(i.discard).toBe(true);
  });

  it('splits snaps into your own cards and other players’ cards with their give options', () => {
    const v = buildFixture('snapGive', 6).before.peeker;
    const i = intentsOf(v);
    const mine = v.players.find((p) => p.id === v.you!.id)!.slots;
    expect([...i.ownSnaps.keys()].sort()).toEqual(mine.map((s) => s.slotId).sort());
    for (const opts of i.otherSnaps.values()) {
      expect(opts.map((a) => a.giveSlotId).sort()).toEqual(mine.map((s) => s.slotId).sort());
    }
  });

  it('blind swaps: second picks are limited to legal pairs with the first', () => {
    const v = buildFixture('blindSwap', 6).before.peeker;
    const pairs = intentsOf(v).blindPairs;
    expect(pairs.length).toBeGreaterThan(0);
    const me = v.you!.id;
    const mine = new Set(v.players.find((p) => p.id === me)!.slots.map((s) => s.slotId));
    // The Jack never touches your own cards.
    for (const id of blindFirsts(pairs)) expect(mine.has(id)).toBe(false);
    const [a, b] = pairs[0]!;
    expect(blindSeconds(pairs, a).has(b)).toBe(true);
    // Never a card of the same player as the first pick.
    const owner = v.players.find((p) => p.slots.some((s) => s.slotId === a))!;
    for (const s of owner.slots) expect(blindSeconds(pairs, a).has(s.slotId)).toBe(false);
    expect(blindPair(pairs, b, a)).toEqual([a, b]);
  });
});

describe('turnsLeft', () => {
  const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, slots: [] }));
  const at = (playerId: string, callerId: string | null) =>
    turnsLeft({ players, callerId, turn: { playerId } as never });
  it('counts everyone from the current player up to the caller', () => {
    expect(at('b', 'a')).toBe(3);
    expect(at('d', 'a')).toBe(1);
    expect(at('a', 'c')).toBe(2);
    expect(at('b', null)).toBe(0);
  });
});
