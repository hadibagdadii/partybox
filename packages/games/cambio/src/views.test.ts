import { describe, expect, it } from 'vitest';
import type { Face } from './cards.js';
import type { CambioState } from './state.js';
import { act, card, facesIn, makeGame, pid, slot, snapAt } from './test-helpers.js';
import { getHostView, getPlayerView } from './views.js';

const hands: Face[][] = [
  [card('A'), card('2'), card('3'), card('4')],
  [card('5'), card('6'), card('7'), card('8')],
  [card('9'), card('10'), card('J'), card('Q')],
];

/** No face in the host view belongs to a card that is face down. */
function hostFacesAreFaceUp(s: CambioState): void {
  const faceDown = new Set([
    ...s.deck.map((c) => c.id),
    ...s.players.flatMap((p) => p.hand.map((x) => x.card.id)),
    ...(s.turn?.drawn ? [s.turn.drawn.id] : []),
  ]);
  for (const f of facesIn(getHostView(s))) expect(faceDown.has(f.cardId)).toBe(false);
}

const remember = { options: { rememberPeeks: true } };

describe('host view', () => {
  it('shows slots, ids, counts and the top discard face only', () => {
    const s = makeGame({ hands, discard: [card('6', 'hearts')] });
    const host = getHostView(s);
    expect(host.players[0]).toEqual({
      id: pid(0),
      name: 'Player 0',
      slots: s.players[0]!.hand.map((x) => ({ slotId: x.id, cardId: x.card.id })),
    });
    expect(host.topDiscard).toEqual({ cardId: s.discard[0]!.id, face: card('6', 'hearts') });
    expect(host).toMatchObject({ deckCount: 20, discardCount: 1, phase: 'play', round: 1 });
    hostFacesAreFaceUp(s);
  });

  it('stays face-up only through draws, peeks and snaps', () => {
    let s = makeGame({ hands, deck: [card('K', 'spades'), card('2')], discard: [card('5')] });
    s = act(s, pid(0), { type: 'draw' });
    hostFacesAreFaceUp(s);
    s = act(s, pid(0), { type: 'discard' });
    s = act(s, pid(0), { type: 'peek', slotId: slot(s, 1, 0).id });
    hostFacesAreFaceUp(s);
    s = act(s, pid(0), { type: 'kingSwap', slotId: slot(s, 0, 0).id });
    hostFacesAreFaceUp(s);
  });
});

describe('player view', () => {
  it('shows nothing private to an unseated id', () => {
    const view = getPlayerView(makeGame({ hands, peek: true }), 'stranger');
    expect(view).toMatchObject({ you: null, drawn: null, peeks: [], known: [], legalActions: [] });
  });

  it('forgets everything with rememberPeeks off', () => {
    let s = makeGame({ hands, deck: [card('7'), card('2')] });
    s = act(s, pid(0), { type: 'draw' });
    s = act(s, pid(0), { type: 'swap', slotId: slot(s, 0, 0).id });
    expect(getPlayerView(s, pid(0)).known).toEqual([]);
  });

  it('only shows a power peek while you are looking', () => {
    let s = makeGame({ hands, deck: [card('9'), card('2')] });
    s = act(act(s, pid(0), { type: 'draw' }), pid(0), { type: 'discard' });
    s = act(s, pid(0), { type: 'peek', slotId: slot(s, 1, 0).id });
    expect(getPlayerView(s, pid(0)).peeks).toHaveLength(1);
    s = act(s, pid(0), { type: 'donePeek' });
    expect(getPlayerView(s, pid(0)).peeks).toEqual([]);
    // Another player's card is never remembered.
    expect(
      getPlayerView({ ...s, options: { ...s.options, rememberPeeks: true } }, pid(0)).known,
    ).toEqual([]);
  });

  it('remembers a drawn card you swapped in, until it moves', () => {
    let s = makeGame({ hands, ...remember, deck: [card('6', 'hearts'), card('Q'), card('2')] });
    s = act(s, pid(0), { type: 'draw' });
    s = act(s, pid(0), { type: 'swap', slotId: slot(s, 0, 1).id });
    expect(getPlayerView(s, pid(0)).known).toEqual([
      {
        playerId: pid(0),
        slotId: slot(s, 0, 1).id,
        cardId: slot(s, 0, 1).card.id,
        face: card('6', 'hearts'),
      },
    ]);
    // Seat 1 draws a Queen and swaps that card away.
    s = act(act(s, pid(1), { type: 'draw' }), pid(1), { type: 'discard' });
    s = act(s, pid(1), { type: 'blindSwap', slotIds: [slot(s, 0, 1).id, slot(s, 2, 0).id] });
    expect(getPlayerView(s, pid(0)).known).toEqual([]);
    expect(getPlayerView(s, pid(2)).known).toEqual([]);
  });

  it('remembers your own peeks and your card shown by a wrong snap', () => {
    let s = makeGame({ hands, ...remember, deck: [card('8'), card('2')], discard: [card('J')] });
    s = act(act(s, pid(0), { type: 'draw' }), pid(0), { type: 'discard' });
    s = act(s, pid(0), { type: 'peek', slotId: slot(s, 0, 2).id });
    s = act(s, pid(0), { type: 'donePeek' });
    expect(getPlayerView(s, pid(0)).known.map((c) => c.face)).toEqual([card('3')]);
    s = act(s, pid(0), snapAt(s, 0, 0));
    expect(getPlayerView(s, pid(0)).known.map((c) => c.face)).toEqual([card('A'), card('3')]);
  });

  it('remembers the card a black King swap brought you', () => {
    let s = makeGame({ hands, ...remember, deck: [card('K', 'clubs'), card('2')] });
    s = act(act(s, pid(0), { type: 'draw' }), pid(0), { type: 'discard' });
    s = act(s, pid(0), { type: 'peek', slotId: slot(s, 2, 3).id });
    s = act(s, pid(0), { type: 'kingSwap', slotId: slot(s, 0, 0).id });
    expect(getPlayerView(s, pid(0)).known.map((c) => c.face)).toEqual([card('Q')]);
    expect(getPlayerView(s, pid(2)).known).toEqual([]);
  });

  it('forgets a card you gave away in a snap', () => {
    let s = makeGame({
      hands,
      ...remember,
      deck: [card('A', 'hearts'), card('2')],
      discard: [card('9')],
    });
    s = act(s, pid(0), { type: 'draw' });
    s = act(s, pid(0), { type: 'swap', slotId: slot(s, 0, 0).id });
    expect(getPlayerView(s, pid(0)).known).toHaveLength(1);
    // Put a 9 on top so seat 0 can snap seat 2's 9, giving away the remembered card.
    s = { ...s, discard: [...s.discard, { id: 'cx', face: card('9', 'hearts') }] };
    s = act(s, pid(0), snapAt(s, 2, 0, slot(s, 0, 0).id));
    expect(getPlayerView(s, pid(0)).known).toEqual([]);
    expect(getPlayerView(s, pid(2)).known).toEqual([]);
  });
});
