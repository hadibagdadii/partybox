import { describe, expect, it } from 'vitest';
import { revealOrder, tallySteps } from './reveal';

describe('round reveal order', () => {
  const seats = ['a', 'b', 'c', 'd'];
  it('starts after the caller and ends on them', () => {
    expect(revealOrder(seats, 'b')).toEqual(['c', 'd', 'a', 'b']);
    expect(revealOrder(seats, 'd')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('goes in seat order when nobody called', () => {
    expect(revealOrder(seats, null)).toEqual(seats);
  });
});

describe('hand totals as cards turn over', () => {
  it('counts up card by card to the score, red Kings and Jokers included', () => {
    expect(
      tallySteps([
        { rank: '7', suit: 'clubs' },
        { rank: 'K', suit: 'hearts' },
        { rank: 'joker', suit: null },
        { rank: 'Q', suit: 'spades' },
      ]),
    ).toEqual([7, 6, 6, 16]);
    expect(tallySteps([])).toEqual([]);
  });
});
