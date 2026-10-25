import type { GameModule, SeatInfo } from '@partybox/shared';
import { z } from 'zod';

/** Dummy game that proves the room plumbing: everyone taps, first tap wins. */

export interface TapRaceState {
  players: SeatInfo[];
  winnerId: string | null;
}

export const tapRaceActionSchema = z.object({ type: z.literal('tap') });
export type TapRaceAction = z.infer<typeof tapRaceActionSchema>;

export type TapRaceEvent = { type: 'won'; playerId: string };

export interface TapRaceHostView {
  players: SeatInfo[];
  winnerId: string | null;
}

export interface TapRacePlayerView extends TapRaceHostView {
  /** Player-only field; the host view must never carry it. */
  youWon: boolean;
}

export const tapRaceModule: GameModule<
  TapRaceState,
  TapRaceAction,
  TapRaceEvent,
  TapRaceHostView,
  TapRacePlayerView
> = {
  id: 'tap-race',
  displayName: 'Tap Race',
  minPlayers: 2,
  maxPlayers: 10,
  actionSchema: tapRaceActionSchema,
  createInitialState: (players) => ({ players: players.map((p) => ({ ...p })), winnerId: null }),
  reduce: (state, { playerId }) => {
    if (!state.players.some((p) => p.id === playerId)) {
      return { ok: false, error: { code: 'not_your_turn', message: 'You are not in this game' } };
    }
    if (state.winnerId) {
      return { ok: false, error: { code: 'wrong_phase', message: 'The race is over' } };
    }
    return {
      ok: true,
      state: { ...state, winnerId: playerId },
      events: [{ type: 'won', playerId }],
    };
  },
  getHostView: (state) => ({ players: state.players, winnerId: state.winnerId }),
  getPlayerView: (state, playerId) => ({
    players: state.players,
    winnerId: state.winnerId,
    youWon: state.winnerId === playerId,
  }),
  isOver: (state) => state.winnerId !== null,
  waitingOn: (state) => (state.winnerId ? [] : state.players.map((p) => p.id)),
};
