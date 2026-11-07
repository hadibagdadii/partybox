import { describe, expect, it } from 'vitest';
import { waitingOn } from './legal.js';
import { act, attempt, card, facesIn, makeGame, pid, slot, snapAt } from './test-helpers.js';
import { getHostView, getPlayerView } from './views.js';

const hands = [
  [card('A'), card('2'), card('3'), card('4')],
  [card('5'), card('6'), card('7'), card('8')],
];

describe('initial peek', () => {
  it('shows each player only their own two bottom cards', () => {
    const s = makeGame({ count: 2, peek: true, hands });
    const view = getPlayerView(s, pid(0));
    expect(view.peeks.map((c) => c.slotId)).toEqual([slot(s, 0, 2).id, slot(s, 0, 3).id]);
    expect(view.peeks.map((c) => c.face)).toEqual([card('3'), card('4')]);
    expect(getPlayerView(s, pid(1)).peeks.map((c) => c.face)).toEqual([card('7'), card('8')]);
    const hostFaces = facesIn(getHostView(s)).map((f) => f.cardId);
    for (const p of s.players) for (const x of p.hand) expect(hostFaces).not.toContain(x.card.id);
  });

  it('lets each player peek once: the cards hide after they confirm ready', () => {
    let s = makeGame({ count: 2, peek: true, hands });
    s = act(s, pid(0), { type: 'ready' });
    expect(getPlayerView(s, pid(0)).peeks).toEqual([]);
    expect(getPlayerView(s, pid(0)).known).toEqual([]);
    expect(getPlayerView(s, pid(1)).peeks).toHaveLength(2);
    expect(attempt(s, pid(0), { type: 'ready' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_action' },
    });
  });

  it('waits for everyone, then starts the first turn', () => {
    let s = makeGame({ count: 3, peek: true, first: 1 });
    expect(waitingOn(s)).toEqual([pid(0), pid(1), pid(2)]);
    s = act(s, pid(2), { type: 'ready' });
    s = act(s, pid(0), { type: 'ready' });
    expect(s.phase).toBe('peek');
    expect(waitingOn(s)).toEqual([pid(1)]);
    const result = attempt(s, pid(1), { type: 'ready' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('play');
    expect(result.events).toEqual([
      { type: 'ready', playerId: pid(1) },
      { type: 'turnStarted', playerId: pid(1) },
    ]);
  });

  it('blocks drawing and snapping until everyone is ready', () => {
    const s = makeGame({ count: 2, peek: true, hands, discard: [card('5')] });
    expect(attempt(s, pid(0), { type: 'draw' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
    expect(attempt(s, pid(1), snapAt(s, 1, 0))).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });

  it('remembers the bottom two after ready when rememberPeeks is on', () => {
    let s = makeGame({ count: 2, peek: true, hands, options: { rememberPeeks: true } });
    s = act(s, pid(0), { type: 'ready' });
    expect(getPlayerView(s, pid(0)).known.map((c) => c.face)).toEqual([card('3'), card('4')]);
  });
});
