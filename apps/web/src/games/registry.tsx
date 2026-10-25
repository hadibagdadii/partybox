import type { LobbyView, PlayerViewMessage } from '@partybox/shared';
import type { ComponentType } from 'react';
import { DiwanDebugPlayer } from './diwan/DiwanDebugPlayer';
import { DiwanDebugHost } from './diwan/DiwanDebugHost';
import { DiwanLobby } from './diwan/phone/screens/DiwanLobby';
import { DiwanPhone } from './diwan/phone/DiwanPhone';
import { DiwanTv } from './diwan/tv/DiwanTv';
import { HeraldLobbyExtras } from './diwan/tv/HeraldSettings';
import { TapRaceHost, TapRacePlayer } from './tap-race/TapRace';

export interface HostScreenProps {
  room: LobbyView;
  /** The game's host projection; each screen knows its own shape. */
  game: unknown;
  /** Abandons this room and starts over; for screens that own the whole viewport. */
  newRoom?: () => void;
}

export interface PlayerScreenProps {
  room: LobbyView;
  you: PlayerViewMessage['you'];
  /** The game's projection for this player. */
  game: unknown;
  /** Sends an action; resolves once the server has answered. */
  act: (action: unknown) => Promise<void>;
  /** Namespace for anything this seat keeps in local storage. */
  seatKey: string;
  /** Returns the room to the lobby; set only for the VIP once the game is over. */
  reset: (() => void) | null;
}

export interface LobbyScreenProps {
  room: LobbyView;
  you: PlayerViewMessage['you'];
  canStart: boolean;
  start: () => void;
}

export interface GameScreens {
  Host: ComponentType<HostScreenProps>;
  /** Plain-text TV screen, shown in dev with ?debug=1 on /host. */
  HostDebug?: ComponentType<HostScreenProps>;
  /** The Host screen owns the whole viewport: no generic header, waiting list, or buttons. */
  hostFullScreen?: boolean;
  /** Extra controls on the generic host lobby (e.g. enabling narration). */
  HostLobbyExtras?: ComponentType;
  Player: ComponentType<PlayerScreenProps>;
  /** Plain-text phone screen, shown in dev with ?debug=1. */
  Debug?: ComponentType<PlayerScreenProps>;
  /** Themed waiting room; the generic one is used otherwise. */
  Lobby?: ComponentType<LobbyScreenProps>;
  /** The Player screen owns the whole viewport, header and reset button included. */
  fullScreen?: boolean;
}

export const gameScreens: Record<string, GameScreens> = {
  diwan: {
    Host: DiwanTv,
    HostDebug: DiwanDebugHost,
    hostFullScreen: true,
    HostLobbyExtras: HeraldLobbyExtras,
    Player: DiwanPhone,
    Debug: DiwanDebugPlayer,
    Lobby: DiwanLobby,
    fullScreen: true,
  },
  'tap-race': { Host: TapRaceHost, Player: TapRacePlayer },
};
