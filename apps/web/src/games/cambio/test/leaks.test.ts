import { describe, expect, it } from 'vitest';
import { expectNoNamedLeak, namesIn } from './leaks';

const el = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d;
};
const seven = { rank: '7', suit: 'hearts' } as const;

describe('the text leak check', () => {
  it('finds names in labels and hidden text, not only what shows', () => {
    expect(namesIn(el('<button aria-label="Your card 1, Seven of Hearts"></button>'))).toEqual(
      new Set(['Seven of Hearts']),
    );
    expect(namesIn(el('<span aria-hidden="true" title="Joker"></span>'))).toEqual(
      new Set(['Joker']),
    );
    expect(namesIn(el('<p>Jokers are 0, red Kings are -1.</p>'))).toEqual(new Set());
  });

  it('fails on a name the viewer may not see, and passes when it is allowed', () => {
    const leak = el('<p>It is the Seven of Hearts</p>');
    expect(() => expectNoNamedLeak(leak, [], 'test')).toThrow(/Seven of Hearts/);
    expect(() => expectNoNamedLeak(leak, [seven], 'test')).not.toThrow();
  });
});
