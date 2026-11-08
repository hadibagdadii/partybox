import { describe, expect, it } from 'vitest';
import type { Face } from './cards.js';
import { legalActions } from './legal.js';
import type { CambioState } from './state.js';
import {
  act,
  actE,
  attempt,
  card,
  makeGame,
  pid,
  slot,
  snapAt,
  type Setup,
} from './test-helpers.js';
import { getHostView, getPlayerView } from './views.js';

const hands = [
  [card('A'), card('2'), card('3'), card('4')],
  [card('5'), card('6'), card('7'), card('8')],
  [card('9'), card('10'), card('J'), card('Q')],
];

/** Seat 0 (or `first`) draws `drawn` and discards it, opening its power. */
function withPower(drawn: Face, setup: Setup = {}): CambioState {
  let s = makeGame({ hands, ...setup, deck: [drawn, ...(setup.deck ?? [card('2'), card('2')])] });
  const actor = s.turn!.playerId;
  s = act(s, actor, { type: 'draw' });
  return act(s, actor, { type: 'discard' });
}

const rejected = (r: ReturnType<typeof attempt>, code = 'invalid_action') =>
  expect(r).toMatchObject({ ok: false, error: { code } });

describe('7 and 8: peek at one of your own cards', () => {
  for (const rank of ['7', '8'] as const) {
    it(`${rank} peeks at your own card only`, () => {
      const s = withPower(card(rank));
      expect(s.turn).toMatchObject({ stage: 'power', power: 'peekOwn' });
      rejected(attempt(s, pid(0), { type: 'peek', slotId: slot(s, 1, 0).id }));
      const target = slot(s, 0, 1);
      const { s: looking, events } = actE(s, pid(0), { type: 'peek', slotId: target.id });
      expect(events).toEqual([
        {
          type: 'powerUsed',
          playerId: pid(0),
          power: 'peekOwn',
          target: { playerId: pid(0), slotId: target.id, cardId: target.card.id },
        },
      ]);
      expect(looking.turn!.stage).toBe('looking');
      expect(getPlayerView(looking, pid(0)).peeks).toEqual([
        { playerId: pid(0), slotId: target.id, cardId: target.card.id, face: card('2') },
      ]);
      expect(getPlayerView(looking, pid(1)).peeks).toEqual([]);
      expect(getHostView(looking).turn!.peekSlotId).toBe(target.id);
      expect(JSON.stringify(events)).not.toContain('rank');

      const done = act(looking, pid(0), { type: 'donePeek' });
      expect(done.turn).toMatchObject({ playerId: pid(1), stage: 'start' });
      expect(getPlayerView(done, pid(0)).peeks).toEqual([]);
    });
  }
});

describe("9 and 10: peek at another player's card", () => {
  for (const rank of ['9', '10'] as const) {
    it(`${rank} peeks at another player's card only`, () => {
      const s = withPower(card(rank));
      expect(s.turn!.power).toBe('peekOther');
      rejected(attempt(s, pid(0), { type: 'peek', slotId: slot(s, 0, 0).id }));
      const looking = act(s, pid(0), { type: 'peek', slotId: slot(s, 2, 3).id });
      expect(getPlayerView(looking, pid(0)).peeks.map((c) => c.face)).toEqual([card('Q')]);
      expect(getPlayerView(looking, pid(2)).peeks).toEqual([]);
    });
  }
});

describe('Jack: blind swap between two other players', () => {
  it('swaps two cards between two other players', () => {
    const s = withPower(card('J'));
    expect(s.turn!.power).toBe('swapOthers');
    const a = slot(s, 1, 0);
    const b = slot(s, 2, 1);
    const { s: after, events } = actE(s, pid(0), { type: 'blindSwap', slotIds: [a.id, b.id] });
    expect(slot(after, 1, 0)).toEqual({ id: a.id, card: b.card, pos: a.pos });
    expect(slot(after, 2, 1)).toEqual({ id: b.id, card: a.card, pos: b.pos });
    expect(events[0]).toEqual({
      type: 'blindSwap',
      playerId: pid(0),
      power: 'swapOthers',
      a: { playerId: pid(1), slotId: a.id, cardId: a.card.id },
      b: { playerId: pid(2), slotId: b.id, cardId: b.card.id },
    });
    expect(after.turn!.playerId).toBe(pid(1));
  });

  it('never touches your own cards', () => {
    const s = withPower(card('J'));
    rejected(
      attempt(s, pid(0), { type: 'blindSwap', slotIds: [slot(s, 0, 0).id, slot(s, 1, 0).id] }),
    );
    const own = new Set(s.players[0]!.hand.map((x) => x.id));
    for (const a of legalActions(s, pid(0))) {
      if (a.type === 'blindSwap') for (const id of a.slotIds) expect(own.has(id)).toBe(false);
    }
  });

  it('needs two different players', () => {
    const s = withPower(card('J'));
    rejected(
      attempt(s, pid(0), { type: 'blindSwap', slotIds: [slot(s, 1, 0).id, slot(s, 1, 1).id] }),
    );
    rejected(
      attempt(s, pid(0), { type: 'blindSwap', slotIds: [slot(s, 1, 0).id, slot(s, 1, 0).id] }),
    );
  });

  it('is skipped when there are not two other players', () => {
    const s = withPower(card('J'), { count: 2, hands: hands.slice(0, 2) });
    expect(s.turn).toMatchObject({ playerId: pid(1), stage: 'start' });
  });
});

describe('Queen: blind swap between any two different players', () => {
  it('may include your own card', () => {
    const s = withPower(card('Q'));
    expect(s.turn!.power).toBe('swapAny');
    const mine = slot(s, 0, 0);
    const theirs = slot(s, 2, 0);
    const after = act(s, pid(0), { type: 'blindSwap', slotIds: [mine.id, theirs.id] });
    expect(slot(after, 0, 0).card).toEqual(theirs.card);
    expect(slot(after, 2, 0).card).toEqual(mine.card);
  });

  it('needs two different players', () => {
    const s = withPower(card('Q'));
    rejected(
      attempt(s, pid(0), { type: 'blindSwap', slotIds: [slot(s, 0, 0).id, slot(s, 0, 1).id] }),
    );
  });

  it('works at a two-player table', () => {
    const s = withPower(card('Q'), { count: 2, hands: hands.slice(0, 2) });
    expect(s.turn!.stage).toBe('power');
    act(s, pid(0), { type: 'blindSwap', slotIds: [slot(s, 0, 0).id, slot(s, 1, 0).id] });
  });
});

describe('black King: peek at any card, then optionally swap', () => {
  for (const suit of ['clubs', 'spades'] as const) {
    it(`the King of ${suit} peeks, then swaps with a different player's card`, () => {
      const s = withPower(card('K', suit));
      expect(s.turn!.power).toBe('peekSwap');
      const peeked = slot(s, 1, 2);
      const { s: deciding, events } = actE(s, pid(0), { type: 'peek', slotId: peeked.id });
      expect(events).toEqual([
        {
          type: 'kingPeek',
          playerId: pid(0),
          target: { playerId: pid(1), slotId: peeked.id, cardId: peeked.card.id },
        },
      ]);
      expect(deciding.turn!.stage).toBe('kingDecide');
      expect(getPlayerView(deciding, pid(0)).peeks.map((c) => c.face)).toEqual([card('7')]);
      rejected(attempt(deciding, pid(0), { type: 'kingSwap', slotId: slot(s, 1, 0).id }));

      const mine = slot(s, 0, 3);
      const { s: after, events: swapEvents } = actE(deciding, pid(0), {
        type: 'kingSwap',
        slotId: mine.id,
      });
      expect(slot(after, 0, 3).card).toEqual(peeked.card);
      expect(slot(after, 1, 2).card).toEqual(mine.card);
      expect(swapEvents[0]).toEqual({
        type: 'kingSwap',
        playerId: pid(0),
        a: { playerId: pid(1), slotId: peeked.id, cardId: peeked.card.id },
        b: { playerId: pid(0), slotId: mine.id, cardId: mine.card.id },
      });
      expect(after.turn!.playerId).toBe(pid(1));
    });
  }

  it('may peek at your own card and swap it to another player', () => {
    const opened = withPower(card('K', 'clubs'));
    const s = act(opened, pid(0), { type: 'peek', slotId: slot(opened, 0, 0).id });
    const own = slot(s, 0, 0);
    expect(s.turn!.peek!.slotId).toBe(own.id);
    const after = act(s, pid(0), { type: 'kingSwap', slotId: slot(s, 2, 0).id });
    expect(slot(after, 2, 0).card).toEqual(own.card);
  });

  it('may keep instead of swapping', () => {
    const s = withPower(card('K', 'spades'));
    const deciding = act(s, pid(0), { type: 'peek', slotId: slot(s, 2, 0).id });
    const { s: after, events } = actE(deciding, pid(0), { type: 'skipPower' });
    expect(events[0]).toEqual({ type: 'powerSkipped', playerId: pid(0), power: 'peekSwap' });
    expect(after.players).toEqual(s.players);
    expect(after.turn!.playerId).toBe(pid(1));
  });

  it('can only keep once the peeked card has moved', () => {
    const s = withPower(card('K', 'spades'), {
      hands: [hands[0], [card('K', 'hearts'), card('6'), card('7'), card('8')], hands[2]],
    });
    const deciding = act(s, pid(0), { type: 'peek', slotId: slot(s, 1, 0).id });
    // Player 1 snaps the peeked King onto the discarded King.
    const moved = act(deciding, pid(1), snapAt(deciding, 1, 0));
    rejected(attempt(moved, pid(0), { type: 'kingSwap', slotId: slot(moved, 2, 0).id }));
    expect(legalActions(moved, pid(0)).filter((a) => a.type !== 'snap')).toEqual([
      { type: 'skipPower' },
    ]);
  });
});

describe('cards without powers', () => {
  const plain: Face[] = [
    card('K', 'hearts'),
    card('K', 'diamonds'),
    card('joker'),
    card('A'),
    card('2'),
    card('3'),
    card('4'),
    card('5'),
    card('6'),
  ];
  for (const face of plain) {
    it(`${face.rank}${face.suit ? ` of ${face.suit}` : ''} ends the turn on discard`, () => {
      const s = withPower(face);
      expect(s.turn).toMatchObject({ playerId: pid(1), stage: 'start', power: null });
    });
  }
});

describe('skipping a power', () => {
  for (const face of [card('7'), card('9'), card('J'), card('Q'), card('K', 'clubs')]) {
    it(`may skip the ${face.rank}`, () => {
      const s = withPower(face);
      const after = act(s, pid(0), { type: 'skipPower' });
      expect(after.turn!.playerId).toBe(pid(1));
      expect(after.players).toEqual(s.players);
    });
  }

  it('skips a 7 automatically when your hand is empty', () => {
    const s = withPower(card('7'), { hands: [[], hands[1], hands[2]] });
    expect(s.turn).toMatchObject({ playerId: pid(1), stage: 'start' });
  });

  it('only accepts the action that matches the power', () => {
    const s = withPower(card('7'));
    rejected(
      attempt(s, pid(0), { type: 'blindSwap', slotIds: [slot(s, 1, 0).id, slot(s, 2, 0).id] }),
    );
    rejected(attempt(s, pid(0), { type: 'kingSwap', slotId: slot(s, 1, 0).id }), 'wrong_phase');
    rejected(attempt(s, pid(1), { type: 'peek', slotId: slot(s, 1, 0).id }), 'not_your_turn');
  });
});

describe('lockCaller and powers', () => {
  /** Seat 0 calls; seat 1 then draws `drawn` and discards it. */
  function afterCall(drawn: Face, lockCaller: boolean): CambioState {
    let s = makeGame({ hands, played: true, options: { lockCaller }, deck: [drawn, card('2')] });
    s = act(s, pid(0), { type: 'callCambio' });
    s = act(s, pid(1), { type: 'draw' });
    return act(s, pid(1), { type: 'discard' });
  }

  it("keeps the caller's cards out of swaps when on", () => {
    const s = afterCall(card('Q'), true);
    rejected(
      attempt(s, pid(1), { type: 'blindSwap', slotIds: [slot(s, 0, 0).id, slot(s, 2, 0).id] }),
    );
    const callerSlots = new Set(s.players[0]!.hand.map((x) => x.id));
    for (const a of legalActions(s, pid(1))) {
      if (a.type === 'blindSwap')
        for (const id of a.slotIds) expect(callerSlots.has(id)).toBe(false);
    }
  });

  it('skips a Jack that would need the locked caller', () => {
    // Seat 1's only other player is the locked caller, so the Jack has no target.
    const s = afterCall(card('J'), true);
    expect(s.turn).toMatchObject({ playerId: pid(2), stage: 'start' });
  });

  it("still allows peeking at the caller's cards", () => {
    const s = afterCall(card('9'), true);
    act(s, pid(1), { type: 'peek', slotId: slot(s, 0, 0).id });
  });

  it('lets a black King peek at the caller but not swap with them', () => {
    const s = afterCall(card('K', 'spades'), true);
    const peekCaller = act(s, pid(1), { type: 'peek', slotId: slot(s, 0, 0).id });
    rejected(attempt(peekCaller, pid(1), { type: 'kingSwap', slotId: slot(s, 1, 0).id }));
    const peekOther = act(s, pid(1), { type: 'peek', slotId: slot(s, 2, 0).id });
    rejected(attempt(peekOther, pid(1), { type: 'kingSwap', slotId: slot(s, 0, 0).id }));
  });

  it("allows swapping the caller's cards when off", () => {
    const s = afterCall(card('Q'), false);
    const after = act(s, pid(1), {
      type: 'blindSwap',
      slotIds: [slot(s, 0, 0).id, slot(s, 2, 0).id],
    });
    expect(slot(after, 0, 0).card).toEqual(slot(s, 2, 0).card);
  });
});
