import {
  cambioModule,
  optionsSchema,
  theme,
  type CambioPlayerView,
  type CambioState,
} from '@partybox/cambio';
import { buildFixture } from '@partybox/cambio/fixtures';
import { createRng, type LobbyView } from '@partybox/shared';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ActResult } from '../../registry';
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
    expect(dialog().getByRole('img', { name: theme.cardName(peeked.face) })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(PEEK_SHOW_MS + 10));
    expect(dialog().queryByRole('img', { name: theme.cardName(peeked.face) })).toBeNull();
    const again = screen.getByRole('button', { name: theme.phone.peekAgain });
    fireEvent.pointerDown(again, { button: 0 });
    expect(dialog().getByRole('img', { name: theme.cardName(peeked.face) })).toBeTruthy();
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
});
