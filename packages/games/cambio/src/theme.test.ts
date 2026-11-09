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

  it('has phone copy, with counts and names filled in', () => {
    for (const [key, v] of Object.entries(theme.phone)) {
      const text = typeof v === 'function' ? (v as (...a: unknown[]) => string)('Amina', 2) : v;
      expect(text, key).toBeTruthy();
    }
    expect(theme.phone.cardCount(1)).toBe('1 card');
    expect(theme.phone.cardCount(6)).toBe('6 cards');
    expect(theme.phone.turnsLeft(1)).toBe('1 turn left');
    expect(theme.phone.turnsLeft(3)).toBe('3 turns left');
    expect(theme.phone.called('Yusuf')).toBe('Yusuf called Cambio');
    expect(theme.phone.tooLate).toBe('Too late');
  });
});

describe('TV and herald copy', () => {
  it('fills in counts, names, and the match target', () => {
    for (const [key, v] of Object.entries(theme.tv)) {
      const arg = key === 'leading' ? ['Amina'] : 'Amina';
      const text = typeof v === 'function' ? (v as (...a: unknown[]) => string)(arg, 2) : v;
      expect(text, key).toBeTruthy();
    }
    expect(theme.tv.finalTurns(3)).toBe('3 final turns');
    expect(theme.tv.finalTurns(1)).toBe('1 final turn');
    expect(theme.tv.chain(3)).toBe('×3');
    expect(theme.tv.leading(['Amina'])).toBe('Leading: Amina');
    expect(theme.tv.leading(['Amina', 'Bot 3'])).toBe('Leading: Amina and Bot 3');
    expect(theme.tv.closestTo('Bot 3', 100)).toBe('Bot 3 is closest to 100');
    expect(theme.tv.playingTo(100)).toBe('Playing to 100');
  });

  it('herald lines are short sentences', () => {
    const lines = [
      theme.herald.ready,
      theme.herald.turn('Amina'),
      theme.herald.called('Amina'),
      theme.herald.snapped('Amina'),
      theme.herald.wrongSnap('Amina'),
      theme.herald.roundWinner(['Amina'], 4),
      theme.herald.roundWinner(['Amina', 'Yusuf'], -1),
      theme.herald.gameWinner(['Amina']),
    ];
    for (const line of lines) {
      expect(line).toMatch(/^[A-Z].*[.!]$/);
      expect(line.split(' ').length).toBeLessThanOrEqual(10);
    }
    expect(theme.herald.roundWinner(['Amina', 'Yusuf'], 2)).toBe(
      'Amina and Yusuf take the round with 2.',
    );
  });
});

describe('strings that take a name read right when the name is You', () => {
  it('the winner line never says "You wins"', () => {
    const { winnerLine } = theme.results;
    expect(winnerLine('game', [], true)).toBe('You win!');
    expect(winnerLine('game', [], true)).toBe(theme.results.youWin);
    expect(winnerLine('round', [], true)).toBe(theme.results.youWinRound);
    expect(winnerLine('game', ['Bot 2'], true)).toBe('You and Bot 2 win the game.');
    expect(winnerLine('round', ['Bot 1', 'Bot 2'], true)).toBe(
      'You, Bot 1 and Bot 2 win the round.',
    );
    expect(winnerLine('game', ['Bot 2'], false)).toBe('Bot 2 wins the game.');
    for (const kind of ['round', 'game'] as const) {
      for (const others of [[], ['Bot 1'], ['Bot 1', 'Bot 2']]) {
        expect(winnerLine(kind, others, true)).not.toMatch(/You wins/);
      }
    }
  });

  it('every phone template with a name has its own you-string, or is only used for others', () => {
    // Used with your own id instead: youCalled, yourCard, yourTurn, and no peek marker at all.
    expect(theme.phone.youCalled).toBe('You called Cambio');
    expect(theme.phone.yourCard(1)).toBe('Your card 1');
    expect(theme.phone.yourTurn).toBe('Your turn');
    // Only ever called with another player's name, so they read as third person.
    expect(theme.phone.called('Bot 1')).toBe('Bot 1 called Cambio');
    expect(theme.phone.turnOf('Bot 1')).toBe("Bot 1's turn");
    expect(theme.phone.peekedBy('Bot 1')).toBe('Bot 1 looked at this');
    expect(theme.phone.miniHand('Bot 1', 4, true)).toBe('Bot 1, 4 cards, their turn');
  });
});
