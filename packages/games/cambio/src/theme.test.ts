import { describe, expect, it } from 'vitest';
import { PHASES, POWER_IDS, RANKS, SCORING_MODES, STAGES, SUITS } from './ids.js';
import type { CambioEvent, CambioEventType } from './state.js';
import { theme } from './theme.js';

const ref = { playerId: 'p1', slotId: 's1', cardId: 'c1' };
const pub = { cardId: 'c1', face: { rank: 'Q', suit: 'hearts' } } as const;
const result = {
  round: 1,
  callerId: 'p0',
  hands: [],
  scores: { p0: 3, p1: 1 },
  winners: ['p1'],
  totals: { p0: 3, p1: 1 },
};

const samples: { [K in CambioEventType]: Extract<CambioEvent, { type: K }> } = {
  dealt: { type: 'dealt', round: 1, firstPlayerId: 'p0', hands: [], discard: pub, deckCount: 40 },
  ready: { type: 'ready', playerId: 'p0' },
  turnStarted: { type: 'turnStarted', playerId: 'p0' },
  drew: { type: 'drew', playerId: 'p0', cardId: 'c1' },
  swapped: { type: 'swapped', playerId: 'p0', slotId: 's1', cardId: 'c2', discarded: pub },
  discardedDrawn: { type: 'discardedDrawn', playerId: 'p0', card: pub },
  powerUsed: { type: 'powerUsed', playerId: 'p0', power: 'peekOther', target: ref },
  powerSkipped: { type: 'powerSkipped', playerId: 'p0', power: 'swapAny' },
  blindSwap: { type: 'blindSwap', playerId: 'p0', power: 'swapOthers', a: ref, b: ref },
  kingPeek: { type: 'kingPeek', playerId: 'p0', target: ref },
  kingSwap: { type: 'kingSwap', playerId: 'p0', a: ref, b: ref },
  snapped: { type: 'snapped', snapperId: 'p0', ownerId: 'p1', slotId: 's1', card: pub, give: null },
  snapFailed: {
    type: 'snapFailed',
    snapperId: 'p0',
    ownerId: 'p1',
    slotId: 's1',
    card: pub,
    penalty: null,
  },
  cambioCalled: { type: 'cambioCalled', playerId: 'p0' },
  reshuffled: { type: 'reshuffled', deckCount: 12 },
  roundRevealed: { type: 'roundRevealed', result },
  gameOver: { type: 'gameOver', winners: ['p1', 'p0'], totals: { p0: 3, p1: 1 } },
};

const names: Record<string, string> = { p0: 'Amina', p1: 'Yusuf' };
const nameOf = (id: string) => names[id] ?? id;

describe('theme', () => {
  it('names every neutral id', () => {
    for (const r of RANKS) expect(theme.ranks[r].name && theme.ranks[r].short).toBeTruthy();
    for (const s of SUITS) expect(theme.suits[s].name && theme.suits[s].symbol).toBeTruthy();
    for (const p of POWER_IDS) expect(theme.powers[p].name && theme.powers[p].hint).toBeTruthy();
    for (const p of PHASES) expect(theme.phases[p]).toBeTruthy();
    for (const s of STAGES) expect(theme.stages[s]).toBeTruthy();
    for (const m of SCORING_MODES) expect(theme.scoringModes[m].name).toBeTruthy();
  });

  it('names cards', () => {
    expect(theme.cardName({ rank: 'Q', suit: 'hearts' })).toBe('Queen of Hearts');
    expect(theme.cardName({ rank: 'joker', suit: null })).toBe('Joker');
  });

  it('writes every event as a sentence, without leaking ids', () => {
    for (const event of Object.values(samples)) {
      const line = theme.describe(event, nameOf);
      expect(line, event.type).toMatch(/^[A-Z].*[.!]$/);
      expect(line).not.toMatch(/\bp[01]\b/);
    }
    expect(theme.describe(samples.gameOver, nameOf)).toBe('Yusuf and Amina won the game.');
  });

  it('has copy for every option', () => {
    for (const o of Object.values(theme.options)) expect(o.label && o.hint).toBeTruthy();
  });
});
