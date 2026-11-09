import {
  cambioModule,
  theme,
  type CambioHostView,
  type CambioPlayerView,
  type CambioState,
} from '@partybox/cambio';
import { buildFixture, card, fillers, stackGame, type FixtureId } from '@partybox/cambio/fixtures';
import { createRng, type LobbyView } from '@partybox/shared';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { CambioTv } from './CambioTv';
import { matchLeaders } from './geometry';
import { tickerLines } from './Ticker';

afterEach(cleanup);

const room = (view: CambioHostView): LobbyView => ({
  code: 'BCDF',
  gameId: 'cambio',
  gameName: theme.title,
  minPlayers: 2,
  maxPlayers: 12,
  phase: view.phase === 'over' ? 'over' : 'playing',
  players: view.players.map((p, i) => ({
    id: p.id,
    name: p.name,
    connected: i !== 3,
    isVip: i === 0,
    isBot: false,
    awayLong: false,
  })),
  tutorial: null,
  options: { ...view.options },
});

function renderTv(view: CambioHostView) {
  const ui = (v: CambioHostView) => (
    <MemoryRouter>
      <CambioTv room={room(v)} game={v} />
    </MemoryRouter>
  );
  const r = render(ui(view));
  return { container: r.container, rerender: (v: CambioHostView) => r.rerender(ui(v)) };
}

const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

/**
 * Card ids everyone has seen face up by `view`: the discard, a wrong snap's card, and once the
 * round is over, every revealed hand.
 */
function publicIds(view: CambioHostView): Set<string> {
  const ids = new Set<string>();
  if (view.topDiscard) ids.add(view.topDiscard.cardId);
  for (const e of view.log) {
    if (e.type === 'dealt') ids.add(e.discard.cardId);
    if (e.type === 'swapped') ids.add(e.discarded.cardId);
    if (e.type === 'discardedDrawn' || e.type === 'snapped' || e.type === 'snapFailed')
      ids.add(e.card.cardId);
    if (e.type === 'roundRevealed')
      for (const h of e.result.hands) for (const c of h.cards) ids.add(c.cardId);
  }
  return ids;
}

/** Faces only the player may see: their drawn card, their peeks, the cards they remember. */
const privateCards = (view: CambioPlayerView) => [
  ...(view.drawn ? [view.drawn] : []),
  ...view.peeks,
  ...view.known,
];

/** Fails if the TV draws any face that isn't public, and checks the player's own faces by name. */
function expectNoHiddenFace(
  container: HTMLElement,
  view: CambioPlayerView,
  seen: Set<string> = new Set(),
) {
  // Cards that were public in an earlier view stay public (a buried discard).
  for (const id of publicIds(view)) seen.add(id);
  const pub = seen;
  for (const el of container.querySelectorAll<HTMLElement>('[data-card-id]')) {
    const id = el.dataset.cardId!;
    if (pub.has(id)) continue;
    expect(el.querySelector('[data-face]'), `card ${id} shows a face`).toBeNull();
    expect(el.querySelector('[data-face-up]'), `card ${id} is face up`).toBeNull();
  }
  // The player's private cards in particular, by id, and by name in any text on screen.
  const publicNames = new Set(
    [...pub].flatMap((id) => {
      const face = [...view.log]
        .flatMap((e) =>
          e.type === 'swapped'
            ? [e.discarded]
            : e.type === 'discardedDrawn' || e.type === 'snapped' || e.type === 'snapFailed'
              ? [e.card]
              : e.type === 'dealt'
                ? [e.discard]
                : [],
        )
        .find((c) => c.cardId === id)?.face;
      return face ? [theme.cardName(face)] : [];
    }),
  );
  for (const c of privateCards(view)) {
    if (pub.has(c.cardId)) continue;
    const el = container.querySelector(`[data-card-id="${c.cardId}"]`);
    expect(el?.querySelector('[data-face]') ?? null, `private ${c.cardId}`).toBeNull();
    const name = theme.cardName(c.face);
    if (!publicNames.has(name)) expect(container.textContent).not.toContain(name);
  }
}

/** A table where Amina remembers cards in her hand and holds a drawn card. */
function rememberingView(): CambioPlayerView {
  const seats = ['Amina', 'Yusuf', 'Layla', 'Omar'].map((name, i) => ({ id: `p${i}`, name }));
  let s: CambioState = cambioModule.createInitialState(seats, createRng(3), {
    scoringMode: 'single',
    matchTarget: 100,
    lockCaller: true,
    rememberPeeks: true,
  });
  s = stackGame(s, {
    hands: [[card('7', 'hearts'), card('Q', 'clubs'), card('4', 'diamonds'), card('9', 'spades')]],
    deck: [card('3', 'hearts'), card('A', 'clubs'), ...fillers(20, '6')],
    discard: [card('8', 'clubs')],
    peek: true,
  });
  const step = (playerId: string, action: Parameters<typeof cambioModule.reduce>[1]['action']) => {
    const r = cambioModule.reduce(s, { playerId, action }, createRng(1));
    if (!r.ok) throw new Error(r.error.message);
    s = r.state;
  };
  for (const p of seats) step(p.id, { type: 'ready' });
  // Play round to Amina, swapping in a card she then remembers, and holding another.
  for (let i = 0; i < 8 && !(s.turn!.playerId === 'p0' && s.turn!.stage === 'start'); i++) {
    const t = s.turn!;
    step(t.playerId, t.stage === 'start' ? { type: 'draw' } : { type: 'discard' });
    if (s.turn?.stage === 'power') step(s.turn.playerId, { type: 'skipPower' });
  }
  step('p0', { type: 'draw' });
  step('p0', { type: 'swap', slotId: s.players[0]!.hand[0]!.id });
  for (let i = 0; i < 12 && !(s.turn!.playerId === 'p0' && s.turn!.stage === 'start'); i++) {
    const t = s.turn!;
    step(t.playerId, t.stage === 'start' ? { type: 'draw' } : { type: 'discard' });
    if (s.turn?.stage === 'power') step(s.turn.playerId, { type: 'skipPower' });
  }
  step('p0', { type: 'draw' });
  return cambioModule.getPlayerView!(s, 'p0') as CambioPlayerView;
}

describe('the TV never shows a face-down card', () => {
  const MOMENTS: FixtureId[] = [
    'peekPhase',
    'draw',
    'swap',
    'discard',
    'peekOwn',
    'peekOther',
    'kingSwap',
    'blindSwap',
    'snapGive',
    'chain',
    'wrongSnap',
    'lockedCall',
    'reshuffle',
  ];

  it.each(MOMENTS)("handed a player's full view through %s", async (id) => {
    const f = buildFixture(id, 6);
    const { container, rerender } = renderTv(f.before.peeker);
    const seen = new Set<string>();
    expectNoHiddenFace(container, f.before.peeker, seen);
    for (const step of f.steps) {
      rerender(step.peeker);
      expectNoHiddenFace(container, step.peeker, seen);
      await wait(30);
      expectNoHiddenFace(container, step.peeker, seen);
    }
    // The fixtures do give the player private faces to leak.
    if (id === 'draw' || id === 'peekOwn' || id === 'peekOther' || id === 'kingSwap') {
      expect(f.steps.some((s) => privateCards(s.peeker).length > 0)).toBe(true);
    }
  });

  it('nor a card the player remembers or is holding', () => {
    const view = rememberingView();
    expect(view.known.length).toBeGreaterThan(0);
    expect(view.drawn).not.toBeNull();
    const { container } = renderTv(view);
    expectNoHiddenFace(container, view);
  });
});

describe('the TV table', () => {
  it('marks a peek with an eye and who looked, leaving the card face down', () => {
    const f = buildFixture('peekOther', 6);
    const peeking = f.steps[0]!.host;
    const { container } = renderTv(peeking);
    const marker = screen.getByTestId('peek-marker');
    expect(marker.textContent).toBe(theme.phone.peekedBy('Amina'));
    const cardId = marker.getAttribute('data-card-id')!;
    expect(container.querySelector(`[data-card-id="${cardId}"] [data-face]`)).toBeNull();
  });

  it("shows the caller with a lock on their hand's corner and the final turns", () => {
    const f = buildFixture('lockedCall', 6);
    renderTv(f.steps.at(-1)!.host);
    expect(screen.getByTestId('lock-badge')).toBeTruthy();
    const banner = screen.getByTestId('cambio-banner');
    expect(banner.getAttribute('data-docked')).toBe('true');
    expect(banner.textContent).toContain(theme.tv.calledShort('Amina'));
    expect(banner.textContent).toMatch(/final turns?/);
    expect(screen.getByTestId('seat-p0').textContent).toContain(theme.tv.caller);
  });

  it('shows who is ready during the initial peek, and who is away', () => {
    const f = buildFixture('peekPhase', 6);
    renderTv(f.steps.at(-1)!.host);
    expect(screen.getByTestId('seat-p1').textContent).toContain(theme.tv.ready);
    expect(screen.getByTestId('seat-p0').textContent).not.toContain(theme.tv.ready);
    expect(screen.getByTestId('seat-p3').textContent).toContain(theme.tv.away);
  });

  it('glows the seat whose turn it is', () => {
    const f = buildFixture('draw', 6);
    renderTv(f.steps[0]!.host);
    expect(screen.getByTestId('seat-p0').hasAttribute('data-turn')).toBe(true);
    expect(screen.getByTestId('turn-glow').getAttribute('data-player')).toBe('p0');
  });
});

describe('round end', () => {
  it('a single round: every hand face up with its score, the winner, and the standings', () => {
    const f = buildFixture('gameOver', 6);
    const view = f.steps.at(-1)!.host;
    const { container } = renderTv(view);
    const result = view.lastRound!;
    for (const hand of result.hands) {
      for (const c of hand.cards) {
        expect(container.querySelector(`[data-card-id="${c.cardId}"] [data-face]`)).not.toBeNull();
      }
      expect(screen.getByTestId(`seat-${hand.playerId}`).textContent).toContain(
        String(result.scores[hand.playerId]),
      );
    }
    const standings = screen.getByTestId('standings');
    expect(standings.hasAttribute('data-over')).toBe(true);
    expect(standings.textContent).toContain(
      theme.results.gameWinner(
        view.winners!.map((id) => view.players.find((p) => p.id === id)!.name),
      ),
    );
    expect(screen.getAllByTestId('winner-ring')).toHaveLength(view.winners!.length);
    expect(screen.queryByTestId('match-line')).toBeNull();
  });

  it('a match: round and running totals, the target, the leader and who is closest', () => {
    const f = buildFixture('matchRoundEnd', 6);
    const view = f.steps.at(-1)!.host;
    renderTv(view);
    const result = view.lastRound!;
    const name = (id: string) => view.players.find((p) => p.id === id)!.name;
    for (const p of view.players) {
      const row = screen.getByTestId(`standing-${p.id}`);
      expect(row.textContent).toContain(String(result.scores[p.id]));
      expect(row.textContent).toContain(String(result.totals[p.id]));
    }
    const { leaders, closest } = matchLeaders(
      result.totals,
      view.players.map((p) => p.id),
    );
    const line = screen.getByTestId('match-line').textContent;
    expect(line).toContain(theme.tv.playingTo(100));
    expect(line).toContain(theme.tv.leading(leaders.map(name)));
    expect(line).toContain(theme.tv.closestTo(name(closest!), 100));
    expect(screen.getByTestId('standings').textContent).toContain(theme.tv.waitingForVip);
  });

  it('counts each total up as its cards turn over, then settles on the scores', async () => {
    const f = buildFixture('gameOver', 6);
    const { rerender } = renderTv(f.before.host);
    rerender(f.steps.at(-1)!.host);
    // The reveal is playing: no standings yet, totals counting.
    expect(screen.queryByTestId('standings')).toBeNull();
    const result = f.steps.at(-1)!.host.lastRound!;
    const tv = screen.getByTestId('cambio-tv');
    for (let i = 0; i < 80 && tv.getAttribute('data-step') !== 'reveal'; i++) await wait(50);
    expect(tv.getAttribute('data-step')).toBe('reveal');
    // The first hand's cards have turned; the last hand's haven't yet.
    await wait(700);
    const counting = screen.getAllByTestId('reveal-tally');
    expect(counting.length).toBeGreaterThan(0);
    expect(counting.length).toBeLessThan(result.hands.length);
    for (let i = 0; i < 120 && !screen.queryByTestId('standings'); i++) await wait(50);
    expect(screen.getByTestId('standings')).toBeTruthy();
    for (const h of result.hands) {
      expect(screen.getByTestId(`seat-${h.playerId}`).textContent).toContain(String(h.score));
    }
  }, 10_000);
});

describe('match leaders', () => {
  it('shares the lead on a tie and names the highest total as closest to the target', () => {
    expect(matchLeaders({ a: 10, b: 30, c: 10 }, ['a', 'b', 'c'])).toEqual({
      leaders: ['a', 'c'],
      closest: 'b',
    });
    expect(matchLeaders({ a: 40, b: 40 }, ['a', 'b'])).toEqual({
      leaders: ['a', 'b'],
      closest: 'a',
    });
    expect(matchLeaders({}, [])).toEqual({ leaders: [], closest: null });
  });
});

describe('ticker', () => {
  const f = buildFixture('chain', 6);
  const log = f.steps.at(-1)!.host.log;
  const name = (id: string) => f.before.host.players.find((p) => p.id === id)!.name;

  it('shows the newest two sentences, skipping turn and draw noise', () => {
    const lines = tickerLines(log, 0, name);
    expect(lines.map((l) => l.text)).toEqual([
      theme.describe(log.at(-2)!, name),
      theme.describe(log.at(-1)!, name),
    ]);
  });

  it('never gets ahead of the cards on the table', () => {
    const lines = tickerLines(log, 1, name);
    expect(lines.at(-1)!.text).toBe(theme.describe(log.at(-2)!, name));
  });
});
