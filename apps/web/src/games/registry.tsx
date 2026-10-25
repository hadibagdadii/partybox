import type { LobbyView, PlayerViewMessage } from '@partybox/shared';
import type { ComponentType } from 'react';
import { DiwanDebugPlayer } from './diwan/DiwanDebugPlayer';
import { DiwanDebugHost } from './diwan/DiwanDebugHost';
import { DiwanLobby } from './diwan/phone/screens/DiwanLobby';
import { DiwanPhone } from './diwan/phone/DiwanPhone';
import { DiwanTv } from './diwan/tv/DiwanTv';
import { HeraldLobbyExtras } from './diwan/tv/HeraldSettings';
import { TutorialPhone } from './diwan/tutorial/TutorialPhone';
import { TutorialTv } from './diwan/tutorial/TutorialTv';
import { TapRaceHost, TapRacePlayer } from './tap-race/TapRace';

export interface HostScreenProps {
  room: LobbyView;
  /** The game's host projection; each screen knows its own shape. */
  game: unknown;
  /** Abandons this room and starts over; for screens that own the whole viewport. */
  newRoom?: () => void;
  /** Ends the game for everyone without revealing anything; back to the lobby. */
  endGame?: () => void;
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
  /** Starts a new game with the same players; set only for the VIP once the game is over. */
  playAgain: (() => void) | null;
}

export interface LobbyScreenProps {
  room: LobbyView;
  you: PlayerViewMessage['you'];
  canStart: boolean;
  start: () => void;
  /** Opens the tutorial on the TV instead of starting; only for games with one. */
  startTutorial?: () => void;
  leave: () => void;
}

export interface TutorialScreenProps {
  room: LobbyView;
  you: PlayerViewMessage['you'];
  step: (dir: 'next' | 'back') => void;
  skip: () => void;
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
  /** Lobby tutorial on the TV, and the phone screen that drives or watches it. */
  HostTutorial?: ComponentType<HostScreenProps>;
  Tutorial?: ComponentType<TutorialScreenProps>;
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
    HostTutorial: TutorialTv,
    Tutorial: TutorialPhone,
  },
  'tap-race': { Host: TapRaceHost, Player: TapRacePlayer },
};
