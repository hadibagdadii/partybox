import {
  buildFaces,
  theme,
  type CambioHostView,
  type CambioPlayerView,
  type Face,
} from '@partybox/cambio';
import { expect } from 'vitest';

/** Every card name a face can have ("Seven of Hearts", "Joker"). Two decks share names. */
const ALL_NAMES = [...new Set(buildFaces(2).map((f) => theme.cardName(f)))];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A whole name, not part of a plural in rule text ("Jokers are 0"). */
const patterns = ALL_NAMES.map((name) => [name, new RegExp(`\\b${escape(name)}\\b(?!s)`)] as const);

/**
 * Every piece of text a person or a screen reader can get from `root`: visible text, and the
 * labels and descriptions on any element, hidden or not.
 */
export function textSurfaces(root: Element): string[] {
  const out = [root.textContent ?? ''];
  for (const el of root.querySelectorAll('*')) {
    for (const attr of ['aria-label', 'aria-description', 'aria-valuetext', 'title', 'alt']) {
      const v = el.getAttribute(attr);
      if (v) out.push(v);
    }
  }
  return out;
}

/** Card names found anywhere in `root`'s text and labels. */
export function namesIn(root: Element): Set<string> {
  const found = new Set<string>();
  for (const text of textSurfaces(root)) {
    for (const [name, re] of patterns) if (re.test(text)) found.add(name);
  }
  return found;
}

/** Faces everyone at the table has seen: the discard, the public log, and a finished round. */
export function publicFaces(view: CambioHostView): Face[] {
  const out: Face[] = [];
  if (view.topDiscard) out.push(view.topDiscard.face);
  for (const e of view.log) {
    if (e.type === 'dealt') out.push(e.discard.face);
    if (e.type === 'swapped') out.push(e.discarded.face);
    if (e.type === 'discardedDrawn' || e.type === 'snapped' || e.type === 'snapFailed')
      out.push(e.card.face);
    if (e.type === 'roundRevealed')
      for (const h of e.result.hands) for (const c of h.cards) out.push(c.face);
  }
  if (view.lastRound && view.phase !== 'play' && view.phase !== 'peek') {
    for (const h of view.lastRound.hands) for (const c of h.cards) out.push(c.face);
  }
  return out;
}

/**
 * Faces this player's phone may name: everything public, plus their own drawn card, their
 * active peeks, and the cards they remember (rememberPeeks). Never anyone else's secrets.
 */
export function phoneFaces(view: CambioPlayerView): Face[] {
  return [
    ...publicFaces(view),
    ...(view.drawn ? [view.drawn.face] : []),
    ...view.peeks.map((p) => p.face),
    ...view.known.map((k) => k.face),
  ];
}

/**
 * Fails if `root` names any card outside `allowed`. Each name found is mapped back to a card
 * this viewer may see; two cards with one name (two decks) are indistinguishable in text.
 */
export function expectNoNamedLeak(root: Element, allowed: Iterable<Face>, where: string) {
  const ok = new Set([...allowed].map((f) => theme.cardName(f)));
  for (const name of namesIn(root)) {
    expect(ok.has(name), `${where}: "${name}" is named but this viewer may not see it`).toBe(true);
  }
}
