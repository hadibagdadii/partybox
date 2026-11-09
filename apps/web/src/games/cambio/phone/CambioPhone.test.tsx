import {
  cambioModule,
  optionsSchema,
  theme,
  type CambioEvent,
  type CambioPlayerView,
  type CambioState,
} from '@partybox/cambio';
import { buildFixture, FIXTURE_IDS } from '@partybox/cambio/fixtures';
import { createRng, type LobbyView } from '@partybox/shared';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ActResult } from '../../registry';
import { handCols, phoneLayout, posesFor } from '../motion/layout';
import { sceneFromView } from '../motion/scene';
import { expectNoNamedLeak, phoneFaces } from '../test/leaks';
import { CambioPhone, PEEK_SHOW_MS } from './CambioPhone';

const W = 375;
const H = 740;
const restore: (() => void)[] = [];

beforeAll(() => {
  // jsdom has no layout and no PointerEvent: give every element the phone's size, and pointer
  // events their coordinates.
  for (const [prop, value] of [
    ['clientWidth', W],
    ['clientHeight', H],
  ] as const) {
    const before = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => value });
    restore.push(() => before && Object.defineProperty(HTMLElement.prototype, prop, before));
  }
  if (!('PointerEvent' in window)) {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill;
    restore.push(() => delete (window as unknown as { PointerEvent?: unknown }).PointerEvent);
  }
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vi.fn(() => true) });
});
afterAll(() => restore.forEach((r) => r()));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(navigator.vibrate).mockClear();
});

const room = (view: CambioPlayerView): LobbyView => ({
  code: 'BCDF',
  gameId: 'cambio',
  gameName: theme.title,
  minPlayers: 2,
  maxPlayers: 12,
  phase: 'playing',
  players: view.players.map((p, i) => ({
    id: p.id,
    name: p.name,
    isVip: i === 0,
    isBot: false,
    connected: true,
    awayLong: false,
  })),
  tutorial: null,
  options: null,
});

type ActFn = (action: unknown, opts?: { quiet?: boolean }) => Promise<ActResult>;

function mount(view: CambioPlayerView, opts: { isVip?: boolean; act?: ActFn } = {}) {
  const sent = vi.fn<ActFn>(opts.act ?? (async () => ({ ok: true })));
  const props = {
    room: room(view),
    you: { id: view.you!.id, name: 'Amina', isVip: opts.isVip ?? false },
    act: sent,
    seatKey: 'k',
    reset: null,
    playAgain: null,
  };
  const r = render(<CambioPhone {...props} game={view} />);
  return {
    sent,
    rerender: (next: CambioPlayerView) => r.rerender(<CambioPhone {...props} game={next} />),
  };
}

/** Card ids drawn face up anywhere in the card layer. */
const faceUpIds = () =>
  [...document.querySelectorAll('[data-card-id]')]
    .filter((el) => el.querySelector('[data-face]'))
    .map((el) => el.getAttribute('data-card-id')!);

const handButton = (slotId: string) =>
  within(screen.getByTestId('hand'))
    .getAllByRole('button')
    .find((b) => b.getAttribute('data-slot') === slotId)!;
const pickerButton = (slotId: string) =>
  within(screen.getByRole('dialog'))
    .getAllByRole('button')
    .find((b) => b.getAttribute('data-slot') === slotId)! as HTMLButtonElement;

function drag(el: Element, dx: number, dy: number) {
  fireEvent.pointerDown(el, { pointerId: 7, clientX: 100, clientY: 400, button: 0 });
  fireEvent.pointerUp(el, { pointerId: 7, clientX: 100 + dx, clientY: 400 + dy, button: 0 });
}
const tap = (el: Element) => drag(el, 0, 0);
const mySlots = (v: CambioPlayerView) => v.players.find((p) => p.id === v.you!.id)!.slots;

describe('initial peek', () => {
  it('shows your bottom two only while you press and hold, then sends ready', () => {
    const view = buildFixture('deal', 6).steps[0]!.peeker;
    expect(view.phase).toBe('peek');
    const peekIds = view.peeks.map((p) => p.cardId);
    expect(peekIds).toHaveLength(2);
    const { sent } = mount(view);
    for (const id of peekIds) expect(faceUpIds()).not.toContain(id);
    const hold = screen.getByRole('button', { name: theme.phone.holdToPeek });
    fireEvent.pointerDown(hold, { button: 0 });
    for (const id of peekIds) expect(faceUpIds()).toContain(id);
    fireEvent.pointerUp(hold);
    for (const id of peekIds) expect(faceUpIds()).not.toContain(id);
    fireEvent.click(screen.getByRole('button', { name: theme.actions.ready }));
    expect(sent).toHaveBeenCalledWith({ type: 'ready' });
  });
});

describe('your turn', () => {
  it('draw buzzes and sends draw', () => {
    const { sent } = mount(buildFixture('draw', 6).before.peeker);
    fireEvent.click(screen.getByRole('button', { name: theme.actions.draw }));
    expect(sent).toHaveBeenCalledWith({ type: 'draw' });
    expect(navigator.vibrate).toHaveBeenCalled();
  });

  it('holding a drawn card: it is face up for you; a tap swaps it in, Discard discards', () => {
    const view = buildFixture('swap', 6).before.peeker;
    expect(faceUpIds).toBeDefined();
    const { sent } = mount(view);
    expect(faceUpIds()).toContain(view.drawn!.cardId);
    const target = mySlots(view)[2]!;
    tap(handButton(target.slotId));
    expect(sent).toHaveBeenLastCalledWith({ type: 'swap', slotId: target.slotId });
    fireEvent.click(screen.getByRole('button', { name: theme.actions.discard }));
    expect(sent).toHaveBeenLastCalledWith({ type: 'discard' });
  });

  it('shows the Cambio banner with turns left after a call', () => {
    const view = buildFixture('call', 6).steps[0]!.peeker;
    mount(view);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain(theme.phone.youCalled);
    expect(banner.textContent).toContain(theme.phone.turnsLeft(5));
  });
});

describe('power targeting', () => {
  it('only legal targets are clickable; a peek then shows the face for a few seconds', () => {
    vi.useFakeTimers();
    const f = buildFixture('peekOther', 6);
    const { sent, rerender } = mount(f.before.peeker);
    fireEvent.click(screen.getByRole('button', { name: theme.phone.usePower }));
    const legal = new Set(
      f.before.peeker.legalActions.flatMap((a) => (a.type === 'peek' ? [a.slotId] : [])),
    );
    const buttons = within(screen.getByRole('dialog'))
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('data-slot')) as HTMLButtonElement[];
    expect(buttons.length).toBeGreaterThan(legal.size - 1);
    for (const b of buttons) expect(b.disabled).toBe(!legal.has(b.getAttribute('data-slot')!));
    const illegal = buttons.find((b) => b.disabled);
    if (illegal) fireEvent.click(illegal);
    expect(sent).not.toHaveBeenCalled();
    const pick = buttons.find((b) => !b.disabled)!.getAttribute('data-slot')!;
    fireEvent.click(pickerButton(pick));
    expect(sent).toHaveBeenCalledWith({ type: 'peek', slotId: pick });

    // The server answers: you are looking at the card.
    const looking = f.steps[0]!.peeker;
    rerender(looking);
    const peeked = looking.peeks[0]!;
    const dialog = () => within(screen.getByRole('dialog'));
    // The picked card's button names the face only while it shows.
    const named = new RegExp(`, ${theme.cardName(peeked.face)}(,|$)`);
    expect(dialog().getByRole('button', { name: named })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(PEEK_SHOW_MS + 10));
    expect(dialog().queryByRole('button', { name: named })).toBeNull();
    const again = screen.getByRole('button', { name: theme.phone.peekAgain });
    fireEvent.pointerDown(again, { button: 0 });
    expect(dialog().getByRole('button', { name: named })).toBeTruthy();
    fireEvent.pointerUp(again);
    fireEvent.click(screen.getByRole('button', { name: theme.actions.donePeek }));
    expect(sent).toHaveBeenLastCalledWith({ type: 'donePeek' });
  });

  it('the Jack takes two picks from two different players', () => {
    const view = buildFixture('blindSwap', 6).before.peeker;
    const { sent } = mount(view);
    fireEvent.click(screen.getByRole('button', { name: theme.phone.usePower }));
    const pairs = view.legalActions.flatMap((a) => (a.type === 'blindSwap' ? [a.slotIds] : []));
    const [a, b] = pairs[0]!;
    fireEvent.click(pickerButton(a));
    expect(sent).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe(theme.phone.pickSecond);
    // Another card of the same player is greyed out for the second pick.
    const owner = view.players.find((p) => p.slots.some((s) => s.slotId === a))!;
    const sibling = owner.slots.find((s) => s.slotId !== a)!;
    expect(pickerButton(sibling.slotId).disabled).toBe(true);
    fireEvent.click(pickerButton(b));
    expect(sent).toHaveBeenCalledWith({ type: 'blindSwap', slotIds: [a, b] });
  });

  it('the black King: pick, peek, then swap with a legal card or keep', () => {
    const f = buildFixture('kingSwap', 6);
    const { sent, rerender } = mount(f.before.peeker);
    fireEvent.click(screen.getByRole('button', { name: theme.phone.usePower }));
    const target = f.before.peeker.legalActions.find((a) => a.type === 'peek')!;
    if (target.type !== 'peek') throw new Error('expected a peek');
    fireEvent.click(pickerButton(target.slotId));
    expect(sent).toHaveBeenLastCalledWith({ type: 'peek', slotId: target.slotId });

    const deciding = f.steps[0]!.peeker;
    expect(deciding.turn?.stage).toBe('kingDecide');
    rerender(deciding);
    const swaps = new Set(
      deciding.legalActions.flatMap((a) => (a.type === 'kingSwap' ? [a.slotId] : [])),
    );
    const dialog = screen.getByRole('dialog');
    for (const b of within(dialog).getAllByRole('button')) {
      const slot = b.getAttribute('data-slot');
      if (slot) expect((b as HTMLButtonElement).disabled).toBe(!swaps.has(slot));
    }
    const swapWith = [...swaps][0]!;
    fireEvent.click(pickerButton(swapWith));
    expect(sent).toHaveBeenLastCalledWith({ type: 'kingSwap', slotId: swapWith });
    fireEvent.click(screen.getByRole('button', { name: theme.actions.keep }));
    expect(sent).toHaveBeenLastCalledWith({ type: 'skipPower' });
  });
});

describe('snapping', () => {
  const view = () => buildFixture('snap', 6).before.peeker;

  it('the hand area never scrolls or pulls to refresh', () => {
    mount(view());
    const hand = screen.getByTestId('hand');
    expect(hand.style.touchAction).toBe('none');
    expect(hand.style.overscrollBehavior).toBe('none');
  });

  it('a swipe of 40 px or more straight up snaps your card, with no confirm', () => {
    const v = view();
    const card = mySlots(v)[1]!;
    const { sent } = mount(v);
    drag(handButton(card.slotId), 0, -39);
    expect(sent).not.toHaveBeenCalled();
    drag(handButton(card.slotId), 40, -60);
    expect(sent).not.toHaveBeenCalled();
    drag(handButton(card.slotId), 80, 0);
    expect(sent).not.toHaveBeenCalled();
    drag(handButton(card.slotId), 0, -40);
    expect(sent).toHaveBeenCalledWith(
      { type: 'snap', slotId: card.slotId, cardId: card.cardId },
      { quiet: true },
    );
    expect(navigator.vibrate).toHaveBeenCalled();
  });

  it('a tap selects your card, and Snap sends it', () => {
    const v = view();
    const card = mySlots(v)[0]!;
    const { sent } = mount(v);
    expect(screen.queryByRole('button', { name: theme.actions.snap })).toBeNull();
    tap(handButton(card.slotId));
    expect(handButton(card.slotId).getAttribute('aria-pressed')).toBe('true');
    expect(sent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: theme.actions.snap }));
    expect(sent).toHaveBeenCalledWith(
      { type: 'snap', slotId: card.slotId, cardId: card.cardId },
      { quiet: true },
    );
  });

  it("snapping another player's card: pick it, then the card you give", () => {
    const v = buildFixture('snapGive', 6).before.peeker;
    const { sent } = mount(v);
    fireEvent.click(screen.getByRole('button', { name: theme.phone.snapOther }));
    const other = v.players.find((p) => p.id !== v.you!.id)!.slots[0]!;
    fireEvent.click(pickerButton(other.slotId));
    expect(sent).not.toHaveBeenCalled();
    expect(screen.getByText(theme.phone.chooseGive)).toBeTruthy();
    const give = mySlots(v)[3]!;
    tap(handButton(give.slotId));
    expect(sent).toHaveBeenCalledWith(
      { type: 'snap', slotId: other.slotId, cardId: other.cardId, giveSlotId: give.slotId },
      { quiet: true },
    );
  });

  it('a wrong snap shows the revealed card; the penalty fills your first empty spot', () => {
    const f = buildFixture('holes', 6);
    const { rerender } = mount(f.steps[2]!.peeker);
    expect(screen.queryByTestId('wrong-snap')).toBeNull();
    const next = f.steps[3]!.peeker;
    rerender(next);
    const e = f.steps[3]!.events.find((x) => x.type === 'snapFailed')!;
    if (e.type !== 'snapFailed') throw new Error('expected snapFailed');
    const notice = screen.getByTestId('wrong-snap');
    expect(notice.textContent).toContain(theme.phone.wrongSnap);
    expect(within(notice).getByRole('img', { name: theme.cardName(e.card.face) })).toBeTruthy();
    expect(e.penalty?.pos).toBe(4);
  });

  it('too late: a brief message by the discard, a light buzz, and no penalty', async () => {
    const v = view();
    const card = mySlots(v)[0]!;
    mount(v, {
      act: async () => ({
        ok: false,
        error: { code: 'invalid_action', message: theme.errors.snapTooLate },
      }),
    });
    drag(handButton(card.slotId), 0, -80);
    const notice = await screen.findByTestId('too-late');
    expect(notice.textContent).toBe(theme.phone.tooLate);
    expect(screen.queryByTestId('wrong-snap')).toBeNull();
    expect(navigator.vibrate).toHaveBeenLastCalledWith(12);
    await waitFor(() => expect(screen.queryByTestId('too-late')).toBeNull(), { timeout: 3000 });
  });
});

describe('round end', () => {
  it('shows your score and the standings; only the VIP gets Next round', () => {
    const view = buildFixture('reveal', 6).steps[0]!.peeker;
    expect(view.phase).toBe('roundOver');
    mount(view);
    const panel = screen.getByTestId('round-end');
    const me = view.you!.id;
    expect(panel.textContent).toContain(String(view.lastRound!.scores[me]));
    for (const p of view.players) expect(screen.getByTestId(`standing-${p.id}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: theme.actions.continue })).toBeNull();
    expect(screen.getByText(theme.phone.waitingForVip)).toBeTruthy();
    cleanup();
    const { sent } = mount(view, { isVip: true });
    fireEvent.click(screen.getByRole('button', { name: theme.actions.continue }));
    expect(sent).toHaveBeenCalledWith({ type: 'continue' });
    // Every hand is revealed: your cards flipped face up.
    for (const s of mySlots(view)) expect(faceUpIds()).toContain(s.cardId);
  });
});

describe('the phone never renders a face it may not see', () => {
  const seats = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase() }));

  /** Card ids this player may see face up right now. */
  function allowed(v: CambioPlayerView, everPublic: Set<string>): Set<string> {
    const ok = new Set(everPublic);
    if (v.drawn) ok.add(v.drawn.cardId);
    for (const p of v.peeks) ok.add(p.cardId);
    if (v.topDiscard) ok.add(v.topDiscard.cardId);
    if (v.lastRound?.round === v.round && v.phase !== 'play' && v.phase !== 'peek') {
      for (const h of v.lastRound.hands) for (const c of h.cards) ok.add(c.cardId);
    }
    return ok;
  }

  it.each([
    ['single', false],
    ['match', true],
  ] as const)(
    'across random %s games (rememberPeeks %s)',
    (mode, remember) => {
      const rng = createRng(mode === 'match' ? 77 : 31);
      let checks = 0;
      for (let game = 0; game < 3; game++) {
        let s: CambioState = cambioModule.createInitialState(
          seats,
          rng,
          optionsSchema.parse({ scoringMode: mode, matchTarget: 40, rememberPeeks: remember }),
        );
        const everPublic = new Set<string>();
        for (let step = 0; step < 400 && !cambioModule.isOver(s); step++) {
          if (step % 2 === 0) {
            for (const p of seats) {
              const v = cambioModule.getPlayerView(s, p.id);
              mount(v);
              const ok = allowed(v, everPublic);
              for (const id of faceUpIds())
                expect(ok.has(id), `${p.id} saw ${id} at ${step}`).toBe(true);
              // The picker and notices only ever show peeks and public reveals.
              for (const el of document.querySelectorAll('[role=dialog] [data-slot]')) {
                if (!el.querySelector('[data-face]')) continue;
                const slot = el.getAttribute('data-slot');
                expect(v.peeks.some((x) => x.slotId === slot)).toBe(true);
              }
              // No card name in any text or label, unless this player may see that card.
              expectNoNamedLeak(document.body, phoneFaces(v), `${p.id} at ${step}`);
              cleanup();
              checks += 1;
            }
          }
          const moves = seats.flatMap((p) =>
            (cambioModule.legalActions?.(s, p.id) ?? []).map((action) => ({
              playerId: p.id,
              action,
            })),
          );
          const snaps = moves.filter((m) => m.action.type === 'snap');
          const turns = moves.filter((m) => m.action.type !== 'snap');
          const pool = snaps.length && (rng.int(6) === 0 || !turns.length) ? snaps : turns;
          const r = cambioModule.reduce(s, pool[rng.int(pool.length)]!, rng);
          if (!r.ok) throw new Error(r.error.message);
          s = r.state;
          for (const e of r.events) {
            if (e.type === 'dealt') everPublic.clear();
            if (e.type === 'snapFailed' || e.type === 'snapped') everPublic.add(e.card.cardId);
            if (e.type === 'swapped') everPublic.add(e.discarded.cardId);
            if (e.type === 'discardedDrawn') everPublic.add(e.card.cardId);
          }
        }
      }
      expect(checks).toBeGreaterThan(60);
    },
    60_000,
  );

  it('with phones kept mounted through whole games, mid-motion included', () => {
    // Each phone stays mounted and sees every broadcast, so its motion queue plays the table:
    // flips, peeks, swaps, and snaps on the mini hands. No frame may show a private face.
    const rng = createRng(2024);
    let checks = 0;
    for (let game = 0; game < 4; game++) {
      let s: CambioState = cambioModule.createInitialState(
        seats,
        rng,
        optionsSchema.parse({
          scoringMode: 'match',
          matchTarget: 30,
          rememberPeeks: game % 2 === 1,
        }),
      );
      // Ids that were ever public this game: a lagging scene may still draw one a moment longer.
      const everPublic = new Set<string>();
      const first = cambioModule.getHostView(s).topDiscard;
      if (first) everPublic.add(first.cardId);
      const phones = new Map<string, HTMLElement>();
      const namedOk = new Map<string, ReturnType<typeof phoneFaces>>();
      const renders = new Map<string, ReturnType<typeof render>>();
      for (const p of seats) {
        const holder = document.createElement('div');
        document.body.appendChild(holder);
        phones.set(p.id, holder);
      }
      const show = (id: string, v: CambioPlayerView) => {
        const props = {
          room: room(v),
          you: { id, name: id, isVip: false },
          act: async () => ({ ok: true }) as ActResult,
          seatKey: 'k',
          reset: null,
          playAgain: null,
        };
        const el = <CambioPhone {...props} game={v} />;
        const r = renders.get(id);
        if (r) r.rerender(el);
        else renders.set(id, render(el, { container: phones.get(id)! }));
      };
      for (let step = 0; step < 300 && !cambioModule.isOver(s); step++) {
        for (const p of seats) {
          const v = cambioModule.getPlayerView(s, p.id);
          show(p.id, v);
          const ok = allowed(v, everPublic);
          const root = phones.get(p.id)!;
          for (const el of root.querySelectorAll('[data-testid=card-layer] [data-card-id]')) {
            if (!el.querySelector('[data-face]')) continue;
            const id = el.getAttribute('data-card-id')!;
            const owner = el.getAttribute('data-owner');
            expect(ok.has(id), `${p.id} saw ${id} (in ${owner ?? 'a pile'}) at ${step}`).toBe(true);
          }
          for (const m of root.querySelectorAll('[data-testid=peek-marker]')) {
            expect(m.querySelector('[data-face]')).toBeNull();
            expect(m.getAttribute('data-peeker')).not.toBe(p.id);
          }
          // A lagging screen may still name a card it was allowed to a moment ago.
          const named = (namedOk.get(p.id) ?? []).concat(phoneFaces(v));
          namedOk.set(p.id, named);
          expectNoNamedLeak(root, named, `${p.id} at ${step}`);
          checks += 1;
        }
        const moves = seats.flatMap((p) =>
          (cambioModule.legalActions?.(s, p.id) ?? []).map((action) => ({
            playerId: p.id,
            action,
          })),
        );
        const snaps = moves.filter((m) => m.action.type === 'snap');
        const turns = moves.filter((m) => m.action.type !== 'snap');
        const pool = snaps.length && (rng.int(5) === 0 || !turns.length) ? snaps : turns;
        const r = cambioModule.reduce(s, pool[rng.int(pool.length)]!, rng);
        if (!r.ok) throw new Error(r.error.message);
        s = r.state;
        for (const e of r.events) {
          if (e.type === 'snapFailed' || e.type === 'snapped') everPublic.add(e.card.cardId);
          if (e.type === 'swapped') everPublic.add(e.discarded.cardId);
          if (e.type === 'discardedDrawn') everPublic.add(e.card.cardId);
          if (e.type === 'dealt') everPublic.add(e.discard.cardId);
          if (e.type === 'roundRevealed')
            for (const h of e.result.hands) for (const c of h.cards) everPublic.add(c.cardId);
        }
      }
      cleanup();
    }
    expect(checks).toBeGreaterThan(400);
  }, 60_000);
});

// ---- The table on the phone: other players' mini hands ----

type Played = { before: CambioState; after: CambioState; events: CambioEvent[] };

/**
 * Plays a seeded random game, preferring powers, until a broadcast matches `want`. Returns the
 * states either side of it, so a test can show the phone the moment it happens.
 */
function playUntil(
  want: (events: CambioEvent[]) => boolean,
  opts: { players?: number; seed?: number } = {},
): Played {
  const seats = Array.from({ length: opts.players ?? 4 }, (_, i) => ({
    id: 'abcdefghijkl'[i]!,
    name: `Bot ${i}`,
  }));
  const rng = createRng(opts.seed ?? 5);
  for (let game = 0; game < 40; game++) {
    let s: CambioState = cambioModule.createInitialState(seats, rng, optionsSchema.parse({}));
    for (let step = 0; step < 500 && !cambioModule.isOver(s); step++) {
      const moves = seats.flatMap((p) =>
        (cambioModule.legalActions?.(s, p.id) ?? []).map((action) => ({ playerId: p.id, action })),
      );
      const powers = moves.filter((m) => ['peek', 'blindSwap', 'kingSwap'].includes(m.action.type));
      const snaps = moves.filter((m) => m.action.type === 'snap');
      const turns = moves.filter((m) => m.action.type !== 'snap');
      const pool = powers.length
        ? powers
        : snaps.length && (rng.int(4) === 0 || !turns.length)
          ? snaps
          : turns;
      const r = cambioModule.reduce(s, pool[rng.int(pool.length)]!, rng);
      if (!r.ok) throw new Error(r.error.message);
      if (want(r.events)) return { before: s, after: r.state, events: r.events };
      s = r.state;
    }
  }
  throw new Error('no such moment in 40 games');
}

const sprite = (cardId: string) =>
  document.querySelector<HTMLElement>(`[data-testid=card-layer] [data-card-id="${cardId}"]`)!;
const spriteX = (cardId: string) =>
  Number(/translateX\(([-\d.]+)px\)/.exec(sprite(cardId).style.transform)?.[1]);

describe('the table on the phone', () => {
  it('shows every other player as a mini hand, two rows for 11 others', () => {
    const p = playUntil((e) => e.some((x) => x.type === 'turnStarted'), { players: 12 });
    const view = cambioModule.getPlayerView(p.after, 'a');
    mount(view);
    const minis = [...document.querySelectorAll('li[data-testid^="mini-"]')];
    expect(minis).toHaveLength(11);
    expect(new Set(minis.map((m) => m.getAttribute('data-row')))).toEqual(new Set(['0', '1']));
    // Each of their cards rests face down in its own hand, at a readable size.
    for (const other of view.players.filter((x) => x.id !== 'a')) {
      for (const s of other.slots) {
        const el = sprite(s.cardId);
        expect(el.getAttribute('data-owner')).toBe(other.id);
        expect(el.getAttribute('data-slot-id')).toBe(s.slotId);
      }
    }
  });

  it.each([
    ['a third player', (owner: string, peeker: string) => owner !== 'a' && peeker !== 'a'],
    ['you', (owner: string, peeker: string) => owner === 'a' && peeker !== 'a'],
  ])("someone else's peek at %s's card: the eye and their name on that card", (_, which) => {
    const p = playUntil((events) =>
      events.some(
        (e) =>
          (e.type === 'powerUsed' || e.type === 'kingPeek') && which(e.target.playerId, e.playerId),
      ),
    );
    const e = p.events.find((x) => x.type === 'powerUsed' || x.type === 'kingPeek')!;
    if (e.type !== 'powerUsed' && e.type !== 'kingPeek') throw new Error('expected a peek');
    const { rerender } = mount(cambioModule.getPlayerView(p.before, 'a'));
    expect(screen.queryByTestId('peek-marker')).toBeNull();
    const after = cambioModule.getPlayerView(p.after, 'a');
    rerender(after);
    const marker = screen.getByTestId('peek-marker');
    expect(marker.getAttribute('data-card-id')).toBe(e.target.cardId);
    expect(marker.getAttribute('data-peeker')).toBe(e.playerId);
    const name = after.players.find((x) => x.id === e.playerId)!.name;
    expect(marker.textContent).toBe(theme.phone.peekedBy(name));
    expect(marker.querySelector('[data-face]')).toBeNull();
    // The peeked card itself stays face down for you.
    expect(faceUpIds()).not.toContain(e.target.cardId);
    expect(sprite(e.target.cardId).getAttribute('data-owner')).toBe(e.target.playerId);
  });

  it('your own peek shows no marker: you see the face instead', () => {
    const p = playUntil((events) =>
      events.some((e) => e.type === 'powerUsed' && e.playerId === 'a' && e.power === 'peekOther'),
    );
    const { rerender } = mount(cambioModule.getPlayerView(p.before, 'a'));
    rerender(cambioModule.getPlayerView(p.after, 'a'));
    expect(screen.queryByTestId('peek-marker')).toBeNull();
  });

  it.each([
    [
      'between two other players',
      (e: { a: { playerId: string }; b: { playerId: string } }) =>
        e.a.playerId !== 'a' && e.b.playerId !== 'a',
    ],
    [
      'with your hand',
      (e: { a: { playerId: string }; b: { playerId: string } }) =>
        e.a.playerId === 'a' || e.b.playerId === 'a',
    ],
  ])('a blind swap %s ends with the right cards in the right slots', (_, which) => {
    vi.useFakeTimers();
    const isSwap = (x: CambioEvent) =>
      (x.type === 'blindSwap' || x.type === 'kingSwap') && which(x);
    const p = playUntil((events) => events.some(isSwap), { seed: 11 });
    const e = p.events.find(isSwap)!;
    if (e.type !== 'blindSwap' && e.type !== 'kingSwap') throw new Error('expected a swap');
    const { rerender } = mount(cambioModule.getPlayerView(p.before, 'a'));
    expect(sprite(e.a.cardId).getAttribute('data-slot-id')).toBe(e.a.slotId);
    rerender(cambioModule.getPlayerView(p.after, 'a'));
    act(() => void vi.advanceTimersByTime(2000));
    expect(sprite(e.a.cardId).getAttribute('data-slot-id')).toBe(e.b.slotId);
    expect(sprite(e.a.cardId).getAttribute('data-owner')).toBe(e.b.playerId);
    expect(sprite(e.b.cardId).getAttribute('data-slot-id')).toBe(e.a.slotId);
    expect(sprite(e.b.cardId).getAttribute('data-owner')).toBe(e.a.playerId);
    expect(faceUpIds()).not.toContain(e.a.cardId);
    expect(faceUpIds()).not.toContain(e.b.cardId);
  });

  it("a card swapped out of another player's hand starts its flight from that hand", () => {
    vi.useFakeTimers();
    const p = playUntil((events) => events.some((e) => e.type === 'swapped' && e.playerId !== 'a'));
    const e = p.events.find((x) => x.type === 'swapped')!;
    if (e.type !== 'swapped') throw new Error('expected a swap');
    const { rerender } = mount(cambioModule.getPlayerView(p.before, 'a'));
    const out = e.discarded.cardId;
    const before = sprite(out).style.transform;
    rerender(cambioModule.getPlayerView(p.after, 'a'));
    // Same frame as the step starts: still in the hand, not already on the discard.
    expect(sprite(out).getAttribute('data-owner')).toBeNull();
    expect(sprite(out).style.transform.split(' ').slice(0, 2)).toEqual(
      before.split(' ').slice(0, 2),
    );
  });

  it('a penalty card starts on the deck, not already in the hand', () => {
    vi.useFakeTimers();
    const p = playUntil((events) =>
      events.some((e) => e.type === 'snapFailed' && e.snapperId !== 'a' && e.penalty !== null),
    );
    const e = p.events.find((x) => x.type === 'snapFailed')!;
    if (e.type !== 'snapFailed' || !e.penalty) throw new Error('expected a penalty');
    const { rerender } = mount(cambioModule.getPlayerView(p.before, 'a'));
    const after = cambioModule.getPlayerView(p.after, 'a');
    rerender(after);
    const scene = sceneFromView(after);
    const cols = Object.fromEntries(
      scene.seats.map((s) => [s.playerId, handCols(s.slots.map((x) => x.pos))]),
    );
    const { deck } = phoneLayout(
      W,
      H,
      after.players.map((x) => x.id),
      'a',
      cols,
    );
    expect(spriteX(e.penalty.cardId)).toBeCloseTo(deck.x, 0);
  });

  it('when a penalty widens a hand, every mini card settles into the new layout', async () => {
    // A wrong snap by someone else whose penalty opens a new column: every hand box shifts.
    const p = playUntil((events) =>
      events.some((e) => e.type === 'snapFailed' && e.snapperId !== 'a' && e.penalty?.pos === 4),
    );
    const { rerender } = mount(cambioModule.getPlayerView(p.before, 'a'));
    const after = cambioModule.getPlayerView(p.after, 'a');
    rerender(after);
    // Real time: Motion's springs only advance on real frames.
    await act(() => new Promise((r) => setTimeout(r, 2500)));
    const scene = sceneFromView(after);
    const cols = Object.fromEntries(
      scene.seats.map((s) => [s.playerId, handCols(s.slots.map((x) => x.pos))]),
    );
    const layout = phoneLayout(
      W,
      H,
      after.players.map((x) => x.id),
      'a',
      cols,
    );
    const poses = posesFor(scene, layout);
    for (const seat of scene.seats.filter((s) => s.playerId !== 'a')) {
      for (const slot of seat.slots) {
        expect(spriteX(slot.cardId), `${seat.playerId} ${slot.slotId}`).toBeCloseTo(
          poses.get(slot.cardId)!.x,
          0,
        );
      }
    }
  });

  it("the caller's mini hand gets the lock badge", () => {
    const p = playUntil((events) =>
      events.some((e) => e.type === 'cambioCalled' && e.playerId !== 'a'),
    );
    const e = p.events.find((x) => x.type === 'cambioCalled')!;
    if (e.type !== 'cambioCalled') throw new Error('expected a call');
    const { rerender } = mount(cambioModule.getPlayerView(p.before, 'a'));
    expect(screen.queryByTestId(`lock-${e.playerId}`)).toBeNull();
    rerender(cambioModule.getPlayerView(p.after, 'a'));
    expect(screen.getByTestId(`lock-${e.playerId}`)).toBeTruthy();
  });
});

describe('the phone never names a card it may not see', () => {
  it.each([5, 12])(
    'through every fixture at %i seats, Rules sheet open and closed',
    (n) => {
      for (const id of FIXTURE_IDS) {
        const f = buildFixture(id, n);
        const { rerender } = mount(f.before.peeker);
        let allowed = phoneFaces(f.before.peeker);
        expectNoNamedLeak(document.body, allowed, `${id} before`);
        f.steps.forEach((step, i) => {
          rerender(step.peeker);
          allowed = allowed.concat(phoneFaces(step.peeker));
          expectNoNamedLeak(document.body, allowed, `${id} step ${i}`);
        });
        // The Rules sheet is rule text only: it names no card at all.
        fireEvent.click(screen.getByRole('button', { name: theme.rules.open }));
        expectNoNamedLeak(
          screen.getByRole('dialog', { name: theme.rules.title }),
          [],
          `${id} rules`,
        );
        cleanup();
      }
    },
    60_000,
  );

  it('names your own remembered card in its button, and nobody else’s', () => {
    const f = buildFixture('peekOwn', 5);
    const looking = f.steps[0]!.peeker;
    mount(looking);
    const peek = looking.peeks[0]!;
    // While the peek shows, your card's button says what it is.
    expect(handButton(peek.slotId).getAttribute('aria-label')).toContain(theme.cardName(peek.face));
    for (const other of mySlots(looking).filter((x) => x.slotId !== peek.slotId)) {
      expect(handButton(other.slotId).getAttribute('aria-label')).toMatch(/face down/);
    }
  });
});

describe('the Rules chip', () => {
  /** An absolutely placed element's box, from its inline style, within the phone. */
  const boxOf = (el: HTMLElement, offsetTop = 0) => ({
    x: parseFloat(el.style.left),
    y: parseFloat(el.style.top) + offsetTop,
    w: parseFloat(el.style.width),
    h: parseFloat(el.style.height),
  });
  const overlaps = (a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it('sits clear of every hand button, at 4 and 12 seats', () => {
    for (const n of [4, 12]) {
      const view = buildFixture('holes', n).steps.at(-1)!.peeker;
      mount(view);
      const chip = screen.getByTestId('rules-chip');
      const c = boxOf(chip);
      expect(c.w).toBeGreaterThanOrEqual(44);
      expect(c.h).toBeGreaterThanOrEqual(44);
      const hand = screen.getByTestId('hand');
      const top = parseFloat(hand.style.top);
      const buttons = within(hand).getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(4);
      for (const b of buttons) expect(overlaps(c, boxOf(b, top))).toBe(false);
      cleanup();
    }
  });

  it('opens the rules, traps focus, and closes on Escape back to the chip', () => {
    mount(buildFixture('draw', 6).steps[0]!.peeker);
    const chip = screen.getByRole('button', { name: theme.rules.open });
    fireEvent.click(chip);
    const dialog = screen.getByRole('dialog', { name: theme.rules.title });
    for (const slide of theme.tutorial.slides) {
      expect(within(dialog).getByText(slide.body)).toBeTruthy();
    }
    const close = within(dialog).getByRole('button', { name: theme.rules.close });
    expect(document.activeElement).toBe(close);
    // The close button is the only focusable thing: Tab stays on it.
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(document.activeElement).toBe(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on a tap outside the sheet', async () => {
    mount(buildFixture('draw', 6).steps[0]!.peeker);
    fireEvent.click(screen.getByRole('button', { name: theme.rules.open }));
    fireEvent.click(screen.getByTestId('rules-backdrop'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: theme.rules.title })).toBeNull(),
    );
  });
});
