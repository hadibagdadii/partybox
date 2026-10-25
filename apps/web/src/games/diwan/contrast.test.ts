import { describe, expect, it } from 'vitest';
import { colors } from './tokens';

/** WCAG 2.x relative luminance of a #rrggbb color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** `top` at `alpha` over `bottom`, as an opaque color. */
function blend(top: string, alpha: number, bottom: string): string {
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const out = [1, 3, 5].map((i) =>
    Math.round(ch(top, i) * alpha + ch(bottom, i) * (1 - alpha))
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${out.join('')}`;
}

const c = colors;
const white = '#ffffff';
const backgrounds = { night: c.night, dusk: c.dusk, indigo: c.indigo } as const;

/** Every token used as text, and the surfaces it sits on. */
const textOnSurfaces: [string, string][] = [
  ['parchment', c.parchment],
  ['mist', c.mist],
  ['gold', c.gold],
  ['goldLight', c.goldLight],
  ['emeraldText', c.emeraldText],
  ['exile', c.exile],
  ['riot', c.riot],
  ['power', c.power],
  ['loyal', c.loyal],
  ['rebelInk', c.rebelInk],
];

/** Text drawn on its own colored field: decree cards, buttons, badges. */
const onFields: [string, string, string][] = [
  ['loyalInk on Loyal Decree', c.loyalInk, c.loyal],
  ['rebelInk on Rebel Decree', c.rebelInk, c.rebel],
  ['ink on gold button', c.ink, c.gold],
  ['ink on goldLight button', c.ink, c.goldLight],
  ['ink on Riot tag', c.ink, c.riot],
  ['white on danger', white, c.danger],
  ["white on Na'am button", white, c.emerald],
  ["white on Na'am button, deep end", white, c.emeraldDeep],
  ['white on Laa button', white, c.indigoLight],
  ['white on Laa button, deep end', white, c.indigo],
  ['parchment on rebel tile', c.parchment, c.rebel],
  // Whole-element opacity: text and field both blend with the night behind.
  ['unselected Loyal Decree (90%)', blend(c.loyalInk, 0.9, c.night), blend(c.loyal, 0.9, c.night)],
  ['unselected Rebel Decree (90%)', blend(c.rebelInk, 0.9, c.night), blend(c.rebel, 0.9, c.night)],
  ["unselected Na'am (80%)", blend(white, 0.8, c.night), blend(c.emerald, 0.8, c.night)],
  ['unselected Laa (80%)', blend(white, 0.8, c.night), blend(c.indigoLight, 0.8, c.night)],
  ['dim note on dusk (80%)', blend(c.parchment, 0.8, c.dusk), c.dusk],
  ['dim heading on dusk (70%)', blend(c.parchment, 0.7, c.dusk), c.dusk],
  ['Rebel vote card subtitle', c.rebelInk, c.rebel],
  ['Loyal vote card subtitle', c.loyalInk, c.loyal],
];

describe('text contrast', () => {
  for (const [name, fg] of textOnSurfaces) {
    for (const [bgName, bg] of Object.entries(backgrounds)) {
      it(`${name} on ${bgName} is at least 4.5:1`, () => {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it.each(onFields)('%s is at least 4.5:1', (_, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('agrees with known WCAG values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
