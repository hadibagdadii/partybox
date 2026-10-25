import { describe, expect, it } from 'vitest';
import { scenarios } from './fixtures';
import { pickScreen } from './screen';

describe('pickScreen', () => {
  it('follows the legal actions', () => {
    expect(pickScreen(scenarios.reveal, false)).toBe('reveal');
    expect(pickScreen(scenarios.nominate, false)).toBe('nominate');
    expect(pickScreen(scenarios.vote, false)).toBe('vote');
    expect(pickScreen(scenarios.discard, false)).toBe('discard');
    expect(pickScreen(scenarios.enact, false)).toBe('enact');
    expect(pickScreen(scenarios.enactVeto, false)).toBe('enact');
    expect(pickScreen(scenarios.vetoAnswer, false)).toBe('vetoAnswer');
    expect(pickScreen(scenarios.investigate, false)).toBe('powerTarget');
    expect(pickScreen(scenarios.successor, false)).toBe('powerTarget');
    expect(pickScreen(scenarios.exile, false)).toBe('powerTarget');
    expect(pickScreen(scenarios.scrolls, false)).toBe('scrolls');
  });

  it('falls back to phase and status when there is nothing to do', () => {
    expect(pickScreen(scenarios.waiting, false)).toBe('waiting');
    expect(pickScreen(scenarios.exiled, false)).toBe('exiled');
    expect(pickScreen(scenarios.gameOver, false)).toBe('gameOver');
  });

  it('shows an unseen spy result before anything else but game over', () => {
    expect(pickScreen(scenarios.nominate, true)).toBe('spyResult');
    expect(pickScreen(scenarios.gameOver, true)).toBe('gameOver');
  });
});
