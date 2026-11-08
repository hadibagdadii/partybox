import {
  cambioModule,
  optionsSchema,
  theme,
  type CambioAction,
  type CambioHostView,
  type CambioPlayerView,
  type CambioState,
} from '@partybox/cambio';
import { createRng, type LobbyView } from '@partybox/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CambioDebugHost } from './CambioDebugHost';
import { CambioDebugPlayer } from './CambioDebugPlayer';
import { cambioOptionFields } from './options';

afterEach(cleanup);

const seats = ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase() }));
const room: LobbyView = {
  code: 'BCDF',
  gameId: 'cambio',
  gameName: theme.title,
  minPlayers: 2,
  maxPlayers: 12,
  phase: 'playing',
  players: seats.map((s) => ({
    ...s,
    isVip: s.id === 'a',
    isBot: false,
    connected: true,
    awayLong: false,
  })),
  tutorial: null,
  options: null,
};

/** A real game, played by the engine until `stop` says so. */
function play(stop: (s: CambioState) => boolean, options = {}): CambioState {
  const rng = createRng(4);
  let s = cambioModule.createInitialState(seats, rng, optionsSchema.parse(options));
  for (let i = 0; i < 500 && !stop(s); i++) {
    const moves = seats.flatMap((p) =>
      (cambioModule.legalActions?.(s, p.id) ?? [])
        .filter((a) => a.type !== 'snap')
        .map((action) => ({ playerId: p.id, action })),
    );
    const call = moves.find((m) => m.action.type === 'callCambio');
    const result = cambioModule.reduce(s, call ?? moves[0]!, rng);
    if (!result.ok) throw new Error(result.error.message);
    s = result.state;
  }
  return s;
}

function phone(view: CambioPlayerView, isVip = false) {
  const act = vi.fn(() => Promise.resolve({ ok: true as const }));
  const you = { id: view.you!.id, name: view.you!.id.toUpperCase(), isVip };
  render(
    <CambioDebugPlayer
      room={room}
      you={you}
      game={view}
      act={act}
      seatKey="k"
      reset={null}
      playAgain={null}
    />,
  );
  return act;
}

describe('Cambio debug phone', () => {
  it('asks for the give card before snapping another player’s card', () => {
    const s = play((st) => st.phase === 'play');
    const me = s.turn!.playerId;
    const view = cambioModule.getPlayerView(s, me);
    const act = phone(view);
    expect(screen.getByRole('button', { name: theme.actions.draw })).toBeTruthy();

    const other = view.players.find((p) => p.id !== me)!;
    fireEvent.click(screen.getByRole('button', { name: `${theme.actions.snap} ${other.name} #1` }));
    expect(act).not.toHaveBeenCalled();
    const gives = screen.getAllByRole('button', { name: /^Your #\d$/ });
    expect(gives).toHaveLength(4);
    fireEvent.click(gives[1]!);
    const mine = view.players.find((p) => p.id === me)!;
    expect(act).toHaveBeenCalledWith({
      type: 'snap',
      slotId: other.slots[0]!.slotId,
      cardId: other.slots[0]!.cardId,
      giveSlotId: mine.slots[1]!.slotId,
    } satisfies CambioAction);
  });

  it('snaps your own card straight away', () => {
    const s = play((st) => st.phase === 'play');
    const view = cambioModule.getPlayerView(s, 'b');
    const act = phone(view);
    fireEvent.click(screen.getByRole('button', { name: `${theme.actions.snap} Your #2` }));
    const own = view.players.find((p) => p.id === 'b')!.slots[1]!;
    expect(act).toHaveBeenCalledWith({ type: 'snap', slotId: own.slotId, cardId: own.cardId });
  });

  it('shows the bottom two during the initial peek', () => {
    const s = play(() => true);
    const view = cambioModule.getPlayerView(s, 'a');
    phone(view);
    const hand = screen.getByTestId('hand').textContent ?? '';
    for (const p of view.peeks) expect(hand).toContain(theme.cardName(p.face));
    expect(hand.match(/face down/g)).toHaveLength(2);
  });

  it('gives only the VIP the Next round button', () => {
    const s = play((st) => st.phase === 'roundOver', { scoringMode: 'match' });
    phone(cambioModule.getPlayerView(s, 'b'));
    expect(screen.queryByRole('button', { name: theme.actions.continue })).toBeNull();
    cleanup();
    const act = phone(cambioModule.getPlayerView(s, 'a'), true);
    fireEvent.click(screen.getByRole('button', { name: theme.actions.continue }));
    expect(act).toHaveBeenCalledWith({ type: 'continue' });
  });
});

describe('Cambio debug TV', () => {
  it('never names a face-down card during play', () => {
    const s = play((st) => st.phase === 'play' && st.turn?.stage === 'drawn');
    const host: CambioHostView = cambioModule.getHostView(s);
    render(<CambioDebugHost room={room} game={host} />);
    const text = screen.getByTestId('players').textContent ?? '';
    for (const p of s.players) {
      for (const slot of p.hand) expect(text).not.toContain(theme.cardName(slot.card.face));
    }
    expect(screen.getByText(/holding a card/)).toBeTruthy();
  });

  it('shows the round results until the VIP moves on', () => {
    const s = play((st) => st.phase === 'roundOver', { scoringMode: 'match' });
    render(<CambioDebugHost room={room} game={cambioModule.getHostView(s)} />);
    const results = screen.getByTestId('round-results').textContent ?? '';
    for (const h of s.rounds[0]!.hands) expect(results).toContain(theme.results.score(h.score));
    expect(screen.getByText(/Waiting for the VIP/)).toBeTruthy();
  });
});

describe('Cambio options fields', () => {
  it('cover exactly the options schema', () => {
    expect(cambioOptionFields.map((f) => f.key).sort()).toEqual(
      Object.keys(optionsSchema.shape).sort(),
    );
  });
});
