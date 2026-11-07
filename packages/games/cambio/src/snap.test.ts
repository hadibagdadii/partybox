import { describe, expect, it } from 'vitest';
import type { Face } from './cards.js';
import {
  act,
  actE,
  attempt,
  callAndFinish,
  card,
  makeGame,
  pid,
  slot,
  snapAt,
  top,
} from './test-helpers.js';
import { getHostView } from './views.js';

const hands: Face[][] = [
  [card('A'), card('2'), card('3'), card('4')],
  [card('5', 'hearts'), card('6'), card('7'), card('8')],
  [card('5', 'clubs'), card('10'), card('J'), card('Q')],
];

/** Discard top is a 5, so both 5s can be snapped. */
const game = (setup = {}) => makeGame({ hands, discard: [card('9'), card('5')], ...setup });

const rejected = (r: ReturnType<typeof attempt>, code = 'invalid_action') =>
  expect(r).toMatchObject({ ok: false, error: { code } });

describe('snapping your own card', () => {
  it('puts it on the discard and shrinks your hand, out of turn', () => {
    const s0 = game();
    const target = slot(s0, 1, 0);
    const { s, events } = actE(s0, pid(1), snapAt(s0, 1, 0));
    expect(s.players[1]!.hand.map((x) => x.id)).not.toContain(target.id);
    expect(s.players[1]!.hand).toHaveLength(3);
    expect(top(s)).toEqual(card('5', 'hearts'));
    expect(events).toEqual([
      {
        type: 'snapped',
        snapperId: pid(1),
        ownerId: pid(1),
        slotId: target.id,
        card: { cardId: target.card.id, face: card('5', 'hearts') },
        give: null,
      },
    ]);
    // It is still seat 0's turn, unchanged.
    expect(s.turn).toEqual(s0.turn);
  });

  it('works on your own turn, even while holding a drawn card', () => {
    const s0 = act(game({ first: 1 }), pid(1), { type: 'draw' });
    const s = act(s0, pid(1), snapAt(s0, 1, 0));
    expect(s.turn).toMatchObject({ playerId: pid(1), stage: 'drawn' });
  });

  it('does not take a give slot', () => {
    const s = game();
    rejected(attempt(s, pid(1), snapAt(s, 1, 0, slot(s, 1, 1).id)));
  });
});

describe("snapping another player's card", () => {
  it('discards it and gives the owner one of your cards in its slot', () => {
    const s0 = game();
    const target = slot(s0, 2, 0);
    const give = slot(s0, 1, 3);
    const { s, events } = actE(s0, pid(1), snapAt(s0, 2, 0, give.id));
    expect(top(s)).toEqual(card('5', 'clubs'));
    expect(slot(s, 2, 0)).toEqual({ id: target.id, card: give.card });
    expect(s.players[2]!.hand).toHaveLength(4);
    expect(s.players[1]!.hand.map((x) => x.id)).toEqual(
      s0.players[1]!.hand.slice(0, 3).map((x) => x.id),
    );
    expect(events).toEqual([
      {
        type: 'snapped',
        snapperId: pid(1),
        ownerId: pid(2),
        slotId: target.id,
        card: { cardId: target.card.id, face: card('5', 'clubs') },
        give: { slotId: give.id, cardId: give.card.id },
      },
    ]);
    // The given card stays face down for the host.
    expect(JSON.stringify(getHostView(s))).not.toContain('"rank":"8"');
  });

  it('requires a give slot from your own hand', () => {
    const s = game();
    rejected(attempt(s, pid(1), snapAt(s, 2, 0)));
    rejected(attempt(s, pid(1), snapAt(s, 2, 0, slot(s, 0, 0).id)));
    rejected(attempt(s, pid(1), snapAt(s, 2, 0, 'nope')));
  });

  it('gives nothing when your hand is empty', () => {
    const s0 = game({ hands: [[], hands[1], hands[2]] });
    rejected(attempt(s0, pid(0), snapAt(s0, 2, 0, 'anything')));
    const { s, events } = actE(s0, pid(0), snapAt(s0, 2, 0));
    expect(s.players[2]!.hand).toHaveLength(3);
    expect(events[0]).toMatchObject({ type: 'snapped', give: null });
  });
});

describe('wrong snaps', () => {
  it('reveals the card to everyone, returns it, and deals the snapper a penalty card', () => {
    const s0 = game({ deck: [card('K', 'hearts'), card('2')] });
    const target = slot(s0, 2, 1);
    const penaltyId = s0.deck[0]!.id;
    const { s, events } = actE(s0, pid(1), snapAt(s0, 2, 1, slot(s0, 1, 0).id));
    expect(slot(s, 2, 1)).toEqual(target);
    expect(top(s)).toEqual(card('5'));
    expect(s.players[1]!.hand).toHaveLength(5);
    const penalty = s.players[1]!.hand[4]!;
    expect(penalty.card.id).toBe(penaltyId);
    expect(s.deck).toHaveLength(1);
    expect(events).toEqual([
      {
        type: 'snapFailed',
        snapperId: pid(1),
        ownerId: pid(2),
        slotId: target.id,
        card: { cardId: target.card.id, face: card('10') },
        penalty: { slotId: penalty.id, cardId: penaltyId },
      },
    ]);
    // The penalty card's face is never shown.
    expect(JSON.stringify(events)).not.toContain('hearts');
  });

  it('penalizes a wrong snap of your own card the same way', () => {
    const s0 = game();
    const s = act(s0, pid(0), snapAt(s0, 0, 0));
    expect(s.players[0]!.hand).toHaveLength(5);
    expect(slot(s, 0, 0)).toEqual(slot(s0, 0, 0));
  });
});

describe('chained snaps and races', () => {
  it('lets more of the same rank follow a snapped card', () => {
    let s = game();
    s = act(s, pid(1), snapAt(s, 1, 0));
    s = act(s, pid(2), snapAt(s, 2, 0));
    expect(s.discard.slice(-3).map((c) => c.face.rank)).toEqual(['5', '5', '5']);
    expect(s.players[1]!.hand).toHaveLength(3);
    expect(s.players[2]!.hand).toHaveLength(3);
  });

  it('rejects the second of two snaps on the same card with no penalty', () => {
    const s0 = game();
    // Seats 0 and 1 both try to snap seat 2's 5, aiming at the same card id.
    const first = snapAt(s0, 2, 0, slot(s0, 0, 0).id);
    const second = snapAt(s0, 2, 0, slot(s0, 1, 0).id);
    const s1 = act(s0, pid(0), first);
    const late = attempt(s1, pid(1), second);
    rejected(late);
    expect(s1.players[1]!.hand).toEqual(s0.players[1]!.hand);
  });

  it('rejects a late snap on your own card that someone already snapped', () => {
    const s0 = game();
    const s1 = act(s0, pid(1), snapAt(s0, 1, 0));
    rejected(attempt(s1, pid(1), snapAt(s0, 1, 0)));
  });

  it('checks against the top discard at arrival', () => {
    // Seat 0 swaps a 9 onto the pile before seat 1's 5-snap arrives: the snap is now wrong.
    let s = game({
      deck: [card('2'), card('2')],
      hands: [[card('9'), ...hands[0]!.slice(1)], hands[1], hands[2]],
    });
    s = act(s, pid(0), { type: 'draw' });
    s = act(s, pid(0), { type: 'swap', slotId: slot(s, 0, 0).id });
    const { events } = actE(s, pid(1), snapAt(s, 1, 0));
    expect(events[0]!.type).toBe('snapFailed');
  });
});

describe('snaps never trigger powers', () => {
  it('snapping a 7 onto a 7 opens no peek', () => {
    const s0 = makeGame({ hands, discard: [card('7', 'hearts')] });
    const s = act(s0, pid(1), snapAt(s0, 1, 2));
    expect(top(s)).toEqual(card('7'));
    expect(s.turn).toEqual(s0.turn);
  });

  it('snapping a Jack opens no swap', () => {
    const s0 = makeGame({ hands, discard: [card('J', 'hearts')] });
    const s = act(s0, pid(2), snapAt(s0, 2, 2));
    expect(s.turn).toEqual(s0.turn);
  });
});

describe('rank matching', () => {
  const cases: [Face, Face, boolean][] = [
    [card('K', 'hearts'), card('K', 'spades'), true],
    [card('K', 'clubs'), card('K', 'diamonds'), true],
    [card('joker'), card('joker'), true],
    [card('6', 'hearts'), card('6', 'clubs'), true],
    [card('6'), card('9'), false],
    [card('joker'), card('A'), false],
    [card('Q'), card('K'), false],
  ];
  for (const [onPile, snapped, ok] of cases) {
    it(`${snapped.rank} onto ${onPile.rank}: ${ok ? 'match' : 'wrong'}`, () => {
      const s = makeGame({
        hands: [[snapped, card('2')], hands[1], hands[2]],
        discard: [onPile],
      });
      const { events } = actE(s, pid(0), snapAt(s, 0, 0));
      expect(events[0]!.type).toBe(ok ? 'snapped' : 'snapFailed');
    });
  }
});

describe('when snapping is closed', () => {
  it('rejects snaps during the initial peek', () => {
    const s = game({ peek: true });
    rejected(attempt(s, pid(1), snapAt(s, 1, 0)), 'wrong_phase');
  });

  it('rejects snaps after the round ends', () => {
    const over = callAndFinish(game({ played: true }));
    expect(over.phase).toBe('over');
    rejected(attempt(over, pid(1), snapAt(over, 1, 0)), 'wrong_phase');
    const between = callAndFinish(game({ played: true, options: { scoringMode: 'match' } }));
    expect(between.phase).toBe('roundOver');
    rejected(attempt(between, pid(1), snapAt(between, 1, 0)), 'wrong_phase');
  });
});

describe('lockCaller and snaps', () => {
  /** Seat 2 calls Cambio while the top discard is a 5. */
  const called = (lockCaller: boolean) =>
    act(game({ first: 2, played: true, options: { lockCaller } }), pid(2), { type: 'callCambio' });

  it("blocks snapping the caller's cards when on", () => {
    const s = called(true);
    rejected(attempt(s, pid(1), snapAt(s, 2, 0, slot(s, 1, 1).id)));
    expect(getHostView(s).lockedPlayerId).toBe(pid(2));
  });

  it('still lets the caller snap', () => {
    const s = called(true);
    act(s, pid(2), snapAt(s, 2, 0));
    act(s, pid(2), snapAt(s, 1, 0, slot(s, 2, 1).id));
  });

  it("allows snapping the caller's card, and giving them a card, when off", () => {
    const s0 = called(false);
    const give = slot(s0, 1, 1);
    const s = act(s0, pid(1), snapAt(s0, 2, 0, give.id));
    expect(slot(s, 2, 0).card).toEqual(give.card);
    expect(getHostView(s).lockedPlayerId).toBeNull();
  });
});
