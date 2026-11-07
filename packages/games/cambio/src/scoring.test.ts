import { describe, expect, it } from 'vitest';
import type { Face } from './cards.js';
import { matchWinners, roundWinners, scoreHand } from './scoring.js';
import type { CambioState } from './state.js';
import { act, attempt, callAndFinish, card, makeGame, pid, type Setup } from './test-helpers.js';
import { getHostView } from './views.js';

const order = [pid(0), pid(1), pid(2)];

describe('hand scores', () => {
  it('sums card values', () => {
    const s = makeGame({
      hands: [[card('joker'), card('K', 'hearts'), card('A'), card('10')]],
    });
    expect(scoreHand(s.players[0]!.hand)).toBe(0 - 1 + 1 + 10);
  });

  it('scores an empty hand 0', () => {
    expect(scoreHand([])).toBe(0);
  });
});

describe('round winners', () => {
  it('lowest score wins', () => {
    expect(roundWinners({ p0: 5, p1: 3, p2: 9 }, order, null)).toEqual([pid(1)]);
  });

  it('a caller alone at the lowest wins', () => {
    expect(roundWinners({ p0: 1, p1: 3, p2: 9 }, order, pid(0))).toEqual([pid(0)]);
  });

  it('a caller tied for lowest loses to the tied non-caller', () => {
    expect(roundWinners({ p0: 3, p1: 3, p2: 9 }, order, pid(0))).toEqual([pid(1)]);
  });

  it('tied non-callers share the win', () => {
    expect(roundWinners({ p0: 3, p1: 3, p2: 3 }, order, pid(0))).toEqual([pid(1), pid(2)]);
    expect(roundWinners({ p0: 9, p1: 3, p2: 3 }, order, pid(0))).toEqual([pid(1), pid(2)]);
    expect(roundWinners({ p0: 3, p1: 3, p2: 9 }, order, null)).toEqual([pid(0), pid(1)]);
  });

  it('negative scores count', () => {
    expect(roundWinners({ p0: -1, p1: 0, p2: 9 }, order, null)).toEqual([pid(0)]);
  });

  it('match winners have the lowest total; ties share', () => {
    expect(matchWinners({ p0: 40, p1: 101, p2: 40 }, order)).toEqual([pid(0), pid(2)]);
  });
});

/** Seat 0 calls; the others draw Twos and discard them; the round ends with these hands. */
function finish(hands: Face[][], setup: Setup = {}): CambioState {
  return callAndFinish(makeGame({ hands, played: true, ...setup }));
}

describe('end of round', () => {
  it('reveals every card with scores and winners', () => {
    const s = finish([[card('A'), card('2')], [card('3')], []]);
    expect(s.phase).toBe('over');
    const result = s.rounds[0]!;
    expect(result.scores).toEqual({ p0: 3, p1: 3, p2: 0 });
    expect(result.winners).toEqual([pid(2)]);
    expect(result.hands[0]!.cards.map((c) => c.face)).toEqual([card('A'), card('2')]);
    expect(result.hands[2]).toEqual({ playerId: pid(2), cards: [], score: 0 });
    const revealed = s.log.find((e) => e.type === 'roundRevealed');
    expect(revealed).toEqual({ type: 'roundRevealed', result });
    expect(getHostView(s).lastRound).toEqual(result);
  });

  it('applies the caller tie rule', () => {
    const s = finish([[card('3')], [card('3')], [card('9')]]);
    expect(s.rounds[0]!.winners).toEqual([pid(1)]);
    expect(s.winners).toEqual([pid(1)]);
  });

  it('lets the caller win when strictly lowest', () => {
    const s = finish([[card('K', 'diamonds')], [card('A')], [card('A')]]);
    expect(s.winners).toEqual([pid(0)]);
  });
});

describe('single round scoring', () => {
  it('ends the game after one round with the round winners', () => {
    const s = finish([[card('9')], [card('A')], [card('5')]]);
    expect(s.phase).toBe('over');
    expect(s.winners).toEqual([pid(1)]);
    expect(s.totals).toEqual({ p0: 9, p1: 1, p2: 5 });
    expect(s.log.at(-1)).toEqual({
      type: 'gameOver',
      winners: [pid(1)],
      totals: { p0: 9, p1: 1, p2: 5 },
    });
    expect(attempt(s, pid(0), { type: 'continue' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });
});

describe('match scoring', () => {
  const match = { options: { scoringMode: 'match' as const, matchTarget: 20 } };

  it('adds scores across rounds and starts the next round on one continue', () => {
    const s1 = finish([[card('9')], [card('A')], [card('5')]], match);
    expect(s1.phase).toBe('roundOver');
    expect(s1.totals).toEqual({ p0: 9, p1: 1, p2: 5 });
    expect(s1.winners).toBeNull();

    const round1Ids = new Set(
      [...s1.deck, ...s1.discard, ...s1.players.flatMap((p) => p.hand.map((x) => x.card))].map(
        (c) => c.id,
      ),
    );
    const result = attempt(s1, pid(2), { type: 'continue' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s2 = result.state;
    expect(result.events.map((e) => e.type)).toEqual(['dealt']);
    expect(s2).toMatchObject({ phase: 'peek', round: 2, callerId: null, readyIds: [] });
    expect(s2.totals).toEqual({ p0: 9, p1: 1, p2: 5 });
    expect(s2.log).toEqual(result.events);
    for (const p of s2.players) expect(p.hand).toHaveLength(4);
    const round2Cards = [
      ...s2.deck,
      ...s2.discard,
      ...s2.players.flatMap((p) => p.hand.map((x) => x.card)),
    ];
    expect(round2Cards).toHaveLength(54);
    for (const c of round2Cards) expect(round1Ids.has(c.id)).toBe(false);
    expect(getHostView(s2).lastRound!.round).toBe(1);

    // A second continue arrives too late.
    expect(attempt(s2, pid(0), { type: 'continue' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });

  it('only continues between rounds', () => {
    expect(attempt(makeGame(), pid(0), { type: 'continue' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });

  it('ends when anyone reaches the target; the lowest total wins', () => {
    let s = finish([[card('9')], [card('A')], [card('5')]], match);
    s = act(s, pid(0), { type: 'continue' });
    // Rig round 2: skip the peek and fix the hands.
    s = makeRound(s, [[card('Q')], [card('4')], [card('2')]]);
    s = callAndFinish(s);
    expect(s.totals).toEqual({ p0: 19, p1: 5, p2: 7 });
    expect(s.phase).toBe('roundOver');

    s = act(s, pid(1), { type: 'continue' });
    s = makeRound(s, [[card('A')], [card('8')], [card('6')]]);
    s = callAndFinish(s);
    expect(s.totals).toEqual({ p0: 20, p1: 13, p2: 13 });
    expect(s.phase).toBe('over');
    expect(s.winners).toEqual([pid(1), pid(2)]);
    expect(s.rounds).toHaveLength(3);
  });
});

/** Skips a fresh round's peek and puts these faces in the hands, seat 0 to call. */
function makeRound(s: CambioState, hands: Face[][]): CambioState {
  const next = makeGame({ hands, played: true, options: s.options });
  return { ...next, round: s.round, totals: s.totals, rounds: s.rounds };
}
