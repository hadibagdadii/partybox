import { createRng } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
import { CARDS_PER_DECK, cardValue, decksFor } from './cards.js';
import { SUITED_RANKS } from './ids.js';
import { defaultOptions, optionsSchema } from './options.js';
import { cardCount } from './rules.js';
import { createInitialState } from './setup.js';
import { pid } from './test-helpers.js';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: pid(i), name: `P${i}` }));

describe('deal', () => {
  for (let n = 2; n <= 12; n++) {
    const decks = n <= 8 ? 1 : 2;
    it(`${n} players use ${decks} deck${decks > 1 ? 's' : ''} and deal 4 each`, () => {
      const s = createInitialState(seats(n), createRng(n));
      const total = decks * CARDS_PER_DECK;
      expect(decksFor(n)).toBe(decks);
      expect(cardCount(s)).toBe(total);
      for (const p of s.players) expect(p.hand).toHaveLength(4);
      expect(s.discard).toHaveLength(1);
      expect(s.deck).toHaveLength(total - 4 * n - 1);
      expect(s.phase).toBe('peek');
      expect(s.log[0]).toMatchObject({ type: 'dealt', round: 1, deckCount: total - 4 * n - 1 });
    });
  }

  it('builds 52 cards plus 2 Jokers per deck', () => {
    for (const n of [4, 10]) {
      const s = createInitialState(seats(n), createRng(3));
      const all = [...s.deck, ...s.discard, ...s.players.flatMap((p) => p.hand.map((x) => x.card))];
      const decks = decksFor(n);
      expect(all.filter((c) => c.face.rank === 'joker')).toHaveLength(2 * decks);
      for (const rank of SUITED_RANKS) {
        for (const suit of ['hearts', 'diamonds', 'clubs', 'spades']) {
          expect(all.filter((c) => c.face.rank === rank && c.face.suit === suit)).toHaveLength(
            decks,
          );
        }
      }
    }
  });

  it('flips the first discard face up into the dealt event', () => {
    const s = createInitialState(seats(3), createRng(5));
    const dealt = s.log[0]!;
    expect(dealt.type).toBe('dealt');
    if (dealt.type !== 'dealt') return;
    expect(dealt.discard).toEqual({ cardId: s.discard[0]!.id, face: s.discard[0]!.face });
    expect(dealt.hands.map((h) => h.slots.length)).toEqual([4, 4, 4]);
    expect(dealt.firstPlayerId).toBe(s.turn!.playerId);
    // The dealt event shows ids only, never the faces of dealt cards.
    expect(JSON.stringify(dealt.hands)).not.toContain('rank');
  });

  it('picks a random first player', () => {
    const firsts = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      firsts.add(createInitialState(seats(4), createRng(seed)).turn!.playerId);
    }
    expect(firsts.size).toBe(4);
  });

  it('gives unique opaque card ids that are unrelated to the face', () => {
    const faceOfC1 = new Set<string>();
    const firstDealtIds = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const s = createInitialState(seats(4), createRng(seed));
      const all = [...s.deck, ...s.discard, ...s.players.flatMap((p) => p.hand.map((x) => x.card))];
      const ids = all.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^c[0-9a-z]+$/);
      const c1 = all.find((c) => c.id === 'c1')!;
      faceOfC1.add(`${c1.face.rank}${c1.face.suit}`);
      firstDealtIds.add(s.players[0]!.hand[0]!.card.id);
    }
    expect(faceOfC1.size).toBeGreaterThan(10);
    expect(firstDealtIds.size).toBeGreaterThan(10);
  });

  it('gives stable unique slot ids', () => {
    const s = createInitialState(seats(5), createRng(2));
    const ids = s.players.flatMap((p) => p.hand.map((x) => x.id));
    expect(new Set(ids).size).toBe(20);
  });

  it('rejects tables outside 2 to 12', () => {
    expect(() => createInitialState(seats(1), createRng(1))).toThrow();
    expect(() => createInitialState(seats(13), createRng(1))).toThrow();
  });

  it('is deterministic for a seed', () => {
    const a = createInitialState(seats(6), createRng(77));
    const b = createInitialState(seats(6), createRng(77));
    expect(a).toEqual(b);
  });
});

describe('options', () => {
  it('defaults to single scoring, target 100, caller locked, no remembered peeks', () => {
    expect(defaultOptions).toEqual({
      scoringMode: 'single',
      matchTarget: 100,
      lockCaller: true,
      rememberPeeks: false,
    });
    expect(createInitialState(seats(2), createRng(1)).options).toEqual(defaultOptions);
  });

  it('takes host options through createInitialState', () => {
    const s = createInitialState(seats(2), createRng(1), {
      scoringMode: 'match',
      matchTarget: 50,
      lockCaller: false,
      rememberPeeks: true,
    });
    expect(s.options).toEqual({
      scoringMode: 'match',
      matchTarget: 50,
      lockCaller: false,
      rememberPeeks: true,
    });
  });

  it('validates options', () => {
    expect(optionsSchema.safeParse({ scoringMode: 'best-of' }).success).toBe(false);
    expect(optionsSchema.safeParse({ matchTarget: 5 }).success).toBe(false);
    expect(optionsSchema.safeParse({ matchTarget: 12.5 }).success).toBe(false);
    expect(optionsSchema.safeParse({ lockCaller: 'yes' }).success).toBe(false);
    expect(() => createInitialState(seats(2), createRng(1), { matchTarget: 0 })).toThrow();
  });
});

describe('card values', () => {
  it('scores Joker 0, red King -1, Ace 1, pips face value, J Q and black K 10', () => {
    expect(cardValue({ rank: 'joker', suit: null })).toBe(0);
    expect(cardValue({ rank: 'K', suit: 'hearts' })).toBe(-1);
    expect(cardValue({ rank: 'K', suit: 'diamonds' })).toBe(-1);
    expect(cardValue({ rank: 'K', suit: 'clubs' })).toBe(10);
    expect(cardValue({ rank: 'K', suit: 'spades' })).toBe(10);
    expect(cardValue({ rank: 'A', suit: 'clubs' })).toBe(1);
    expect(cardValue({ rank: 'J', suit: 'hearts' })).toBe(10);
    expect(cardValue({ rank: 'Q', suit: 'clubs' })).toBe(10);
    for (let v = 2; v <= 10; v++) {
      expect(cardValue({ rank: String(v) as '2', suit: 'spades' })).toBe(v);
    }
  });
});
