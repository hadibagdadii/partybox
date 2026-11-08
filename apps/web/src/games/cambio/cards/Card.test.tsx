import { buildFaces, cardValue, theme, type Face } from '@partybox/cambio';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Card } from './Card';
import { badgeValue } from './CardFace';

afterEach(cleanup);

const FACES = buildFaces(1);
const id = (f: Face) => `${f.rank}-${f.suit ?? 'none'}`;
const rankText = (el: HTMLElement) =>
  [...el.querySelectorAll('[data-part="rank"]')].map((t) => t.textContent);
const badgeText = (el: HTMLElement) => el.querySelector('[data-part="badge"]')?.textContent ?? null;

describe('Card faces', () => {
  it('builds 54 faces: every rank in every suit plus two Jokers', () => {
    expect(FACES).toHaveLength(54);
    expect(FACES.filter((f) => f.rank === 'joker')).toHaveLength(2);
  });

  it.each(FACES.map((f, i) => [`${theme.cardName(f)} #${i}`, f] as const))(
    'renders the %s',
    (_, face) => {
      const { container, getByRole } = render(<Card face={face} faceUp size="pile" />);
      const card = getByRole('img');
      expect(card.getAttribute('aria-label')).toBe(theme.cardName(face));
      expect(container.querySelector(`[data-face="${id(face)}"]`)).not.toBeNull();
      // Both corner indices show the rank.
      expect(rankText(container)).toEqual([
        theme.ranks[face.rank].short,
        theme.ranks[face.rank].short,
      ]);
      // Suits are drawn as shapes: two corner pips at least, plus the center art.
      expect(container.querySelectorAll('svg path, svg polygon').length).toBeGreaterThan(2);
    },
  );

  it('marks red Kings with -1 and Jokers with 0, and nothing else', () => {
    for (const face of FACES) {
      const { container, unmount } = render(<Card face={face} faceUp />);
      const badge = badgeText(container);
      if (face.rank === 'joker') expect(badge).toBe('0');
      else if (face.rank === 'K' && cardValue(face) < 0) expect(badge).toBe('−1');
      else expect(badge).toBeNull();
      unmount();
    }
    expect(badgeValue({ rank: 'K', suit: 'hearts' })).toBe(-1);
    expect(badgeValue({ rank: 'K', suit: 'diamonds' })).toBe(-1);
    expect(badgeValue({ rank: 'K', suit: 'spades' })).toBeNull();
    expect(badgeValue({ rank: 'K', suit: 'clubs' })).toBeNull();
    expect(badgeValue({ rank: 'joker', suit: null })).toBe(0);
  });

  it('draws red suits red and black suits and Jokers in ink', () => {
    const fill = (face: Face) => {
      const { container, unmount } = render(<Card face={face} faceUp />);
      const color = container.querySelector('[data-part="rank"]')!.getAttribute('fill');
      unmount();
      return color;
    };
    expect(fill({ rank: 'K', suit: 'hearts' })).toBe(fill({ rank: '2', suit: 'diamonds' }));
    expect(fill({ rank: 'K', suit: 'spades' })).toBe(fill({ rank: 'joker', suit: null }));
    expect(fill({ rank: 'K', suit: 'hearts' })).not.toBe(fill({ rank: 'K', suit: 'spades' }));
  });
});

describe('Card backs', () => {
  it('a face-down card never carries its face, even when the face is known', () => {
    for (const face of [FACES[0]!, FACES[12]!, FACES[53]!]) {
      const { container, getByRole, unmount } = render(<Card face={face} faceUp={false} />);
      expect(getByRole('img').getAttribute('aria-label')).toBe(theme.cards.faceDown);
      expect(container.querySelector('[data-face]')).toBeNull();
      expect(rankText(container)).toEqual([]);
      expect(container.querySelector('[data-back]')).not.toBeNull();
      unmount();
    }
  });

  it('the back alone shows no rank or suit', () => {
    const { container } = render(<Card face={null} faceUp={false} />);
    expect(container.querySelector('[data-face]')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('a staged flip carries the face while it runs', () => {
    const face = FACES[4]!;
    const { container } = render(
      <Card face={face} faceUp={false} flip={{ rotateY: [180, 0, 0, 180], duration: 0.8 }} />,
    );
    expect(container.querySelector(`[data-face="${id(face)}"]`)).not.toBeNull();
  });
});
