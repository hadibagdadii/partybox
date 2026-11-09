import { describe, expect, it } from 'vitest';
import { blend, contrast } from '../../lib/contrast';
import { colors as c } from './tokens';

const white = '#ffffff';
/** The quiet button and seat plates: rgba(5,24,18,.6) over the felt. */
const quietOnFelt = blend('#051812', 0.6, c.felt);
const tvBackground = '#07130f';
const sheet = '#06201a';

/** Body text: 4.5:1. */
const text: [string, string, string][] = [
  ['chalk on felt', c.chalk, c.felt],
  ['chalk on deep felt', c.chalk, c.feltDeep],
  ['chalk on felt edge', c.chalk, c.feltEdge],
  ['chalkDim on felt', c.chalkDim, c.felt],
  ['chalkDim on deep felt', c.chalkDim, c.feltDeep],
  ['chalkDim on the TV background', c.chalkDim, tvBackground],
  ['chalk on the quiet button', c.chalk, quietOnFelt],
  ['chalk on the Rules sheet', c.chalk, sheet],
  ['brassLight on the TV background', c.brassLight, tvBackground],
  ['brassLight on the Rules sheet', c.brassLight, sheet],
  ['glow (your turn) on deep felt', c.glow, c.feltDeep],
  ['ink on brass (primary button)', c.ink, c.brass],
  ['ink on glow (selected, turn plate)', c.ink, c.glow],
  ['ink on card stock', c.ink, c.stock],
  ['red suit on card stock', c.red, c.stock],
  ['white on danger (Call Cambio, toasts)', white, c.danger],
  ['white on the -1 badge', white, c.badgeMinus],
  ['white on the 0 badge', white, c.badgeZero],
  ['glow on ink (eye badge)', c.glow, c.ink],
];

/** Non-text marks: 3:1. (Disabled buttons are exempt in WCAG, so they are not listed.) */
const large: [string, string, string][] = [
  ['focus ring (glow) on felt', c.glow, c.felt],
  ['focus ring (glow) on the TV background', c.glow, tvBackground],
];

describe('Cambio contrast', () => {
  it.each(text)('%s is at least 4.5:1', (_, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(large)('%s is at least 3:1', (_, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});
