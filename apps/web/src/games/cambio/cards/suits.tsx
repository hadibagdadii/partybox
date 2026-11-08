import type { Suit } from '@partybox/cambio';

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/** Our own suit shapes, each in a 100×100 box. */
const SUIT_PATHS: Record<Suit, string> = {
  hearts:
    'M50 90C21 69 5 51 5 31 5 16 16 6 29 6c9 0 17 5 21 14 4-9 12-14 21-14 13 0 24 10 24 25 0 20-16 38-45 59Z',
  diamonds: 'M50 3 85 50 50 97 15 50Z',
  spades:
    'M50 5c13 21 44 35 44 56 0 13-10 21-22 21-8 0-15-4-19-11 1 10 5 17 12 23H35c7-6 11-13 12-23-4 7-11 11-19 11C16 82 6 74 6 61 6 40 37 26 50 5Z',
  clubs: [
    circle(50, 28, 20),
    circle(27, 58, 20),
    circle(73, 58, 20),
    circle(50, 52, 12),
    'M46 62c0 13-4 23-12 32h32c-8-9-12-19-12-32Z',
  ].join(''),
};

export const isRedSuit = (suit: Suit | null) => suit === 'hearts' || suit === 'diamonds';

/** A suit symbol centered on (x, y), `size` wide, optionally upside down. */
export function Pip({
  suit,
  x,
  y,
  size,
  flip = false,
  fill,
}: {
  suit: Suit;
  x: number;
  y: number;
  size: number;
  flip?: boolean;
  fill: string;
}) {
  const s = size / 100;
  const rotate = flip ? ` rotate(180 50 50)` : '';
  return (
    <path
      d={SUIT_PATHS[suit]}
      fill={fill}
      transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})${rotate}`}
    />
  );
}

/** An eight-point star, the Joker's mark, centered on (x, y) with outer radius `r`. */
export function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const d = i % 2 === 0 ? r : r * 0.42;
    pts.push(`${(x + d * Math.cos(a)).toFixed(2)},${(y + d * Math.sin(a)).toFixed(2)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} />;
}
