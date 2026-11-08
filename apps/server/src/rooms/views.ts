import type {
  AnyGameModule,
  GameOption,
  HostViewMessage,
  LobbyView,
  PlayerViewMessage,
} from '@partybox/shared';
import { AWAY_LONG_MS, type Room } from './room.js';

/** The room's options for `game`, defaults filled in; null for games without options. */
export function roomOptions(room: Room, game: AnyGameModule): Record<string, unknown> | null {
  if (!game.optionsSchema) return null;
  const stored = room.options.get(game.id);
  if (stored) return stored;
  return game.optionsSchema.parse(game.defaultOptions ?? {}) as Record<string, unknown>;
}

/** Whether `playerId` may send `action` in this room: VIP-only actions need the VIP. */
export function maySend(
  room: Room,
  game: AnyGameModule,
  playerId: string,
  action: unknown,
): boolean {
  const type = (action as { type?: unknown } | null)?.type;
  if (typeof type !== 'string' || !game.vipOnlyActions?.includes(type)) return true;
  if (room.vipId !== null) return playerId === room.vipId;
  // A room with no human VIP is all bots; any of them may advance it.
  return room.seats.some((s) => s.id === playerId && s.isBot);
}

/**
 * Players the game waits on who can actually move it: someone whose only legal actions are
 * VIP-only ones they may not send (e.g. Next round) is not listed.
 */
export function waitingOn(room: Room, game: AnyGameModule): string[] {
  if (!room.game || !game.waitingOn) return [];
  const { state } = room.game;
  const ids = game.waitingOn(state);
  if (!game.vipOnlyActions?.length || !game.legalActions) return ids;
  return ids.filter((id) =>
    (game.legalActions?.(state, id) ?? []).some((a) => maySend(room, game, id, a)),
  );
}

export function buildLobbyView(room: Room, game: AnyGameModule, now: number): LobbyView {
  return {
    code: room.code,
    gameId: game.id,
    gameName: game.displayName,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    phase: room.phase,
    // Pick fields explicitly so seat tokens can never leak.
    players: room.seats.map((s) => ({
      id: s.id,
      name: s.name,
      isVip: s.id === room.vipId,
      isBot: s.isBot,
      connected: s.connected,
      awayLong: s.disconnectedAt !== null && now - s.disconnectedAt >= AWAY_LONG_MS,
    })),
    tutorial:
      room.tutorial !== null && game.tutorialSlides
        ? { slide: room.tutorial, total: game.tutorialSlides }
        : null,
    options: roomOptions(room, game),
  };
}

/** Public projection only: built from `getHostView`, never `getPlayerView`. */
export function buildHostView(
  room: Room,
  game: AnyGameModule,
  games: GameOption[],
  now: number,
): HostViewMessage {
  return {
    room: buildLobbyView(room, game, now),
    games,
    waitingOn: waitingOn(room, game),
    game: room.game ? game.getHostView(room.game.state) : null,
  };
}

export function buildPlayerView(
  room: Room,
  game: AnyGameModule,
  playerId: string,
  now: number,
): PlayerViewMessage | null {
  const seat = room.seats.find((s) => s.id === playerId);
  if (!seat) return null;
  const isVip = seat.id === room.vipId;
  return {
    room: buildLobbyView(room, game, now),
    you: { id: seat.id, name: seat.name, isVip },
    canStart: isVip && room.phase === 'lobby' && room.seats.length >= game.minPlayers,
    game: room.game ? game.getPlayerView(room.game.state, playerId) : null,
  };
}
