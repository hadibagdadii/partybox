import type {
  AnyGameModule,
  GameOption,
  HostViewMessage,
  LobbyView,
  PlayerViewMessage,
} from '@partybox/shared';
import type { Room } from './room.js';

export function buildLobbyView(room: Room, game: AnyGameModule): LobbyView {
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
    })),
  };
}

/** Public projection only: built from `getHostView`, never `getPlayerView`. */
export function buildHostView(
  room: Room,
  game: AnyGameModule,
  games: GameOption[],
): HostViewMessage {
  return {
    room: buildLobbyView(room, game),
    games,
    waitingOn: room.game && game.waitingOn ? game.waitingOn(room.game.state) : [],
    game: room.game ? game.getHostView(room.game.state) : null,
  };
}

export function buildPlayerView(
  room: Room,
  game: AnyGameModule,
  playerId: string,
): PlayerViewMessage | null {
  const seat = room.seats.find((s) => s.id === playerId);
  if (!seat) return null;
  const isVip = seat.id === room.vipId;
  return {
    room: buildLobbyView(room, game),
    you: { id: seat.id, name: seat.name, isVip },
    canStart: isVip && room.phase === 'lobby' && room.seats.length >= game.minPlayers,
    game: room.game ? game.getPlayerView(room.game.state, playerId) : null,
  };
}
