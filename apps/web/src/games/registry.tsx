import type { LobbyView, PlayerViewMessage } from '@partybox/shared';
import type { ComponentType } from 'react';
import { CambioDebugHost } from './cambio/CambioDebugHost';
import { CambioDebugPlayer } from './cambio/CambioDebugPlayer';
import { CambioPhone } from './cambio/phone/CambioPhone';
import { cambioOptionFields } from './cambio/options';
import { CambioLobbyExtras } from './cambio/tv/CambioSettings';
import { CambioTv } from './cambio/tv/CambioTv';
import { DiwanDebugPlayer } from './diwan/DiwanDebugPlayer';
import { DiwanDebugHost } from './diwan/DiwanDebugHost';
import { DiwanLobby } from './diwan/phone/screens/DiwanLobby';
import { DiwanPhone } from './diwan/phone/DiwanPhone';
import { DiwanTv } from './diwan/tv/DiwanTv';
import { HeraldLobbyExtras } from './diwan/tv/HeraldSettings';
import { TutorialPhone } from './diwan/tutorial/TutorialPhone';
import { TutorialTv } from './diwan/tutorial/TutorialTv';
import type { OptionField } from './options';
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

/** The server's answer to an action. */
export type ActResult = { ok: true } | { ok: false; error: { code: string; message: string } };

export interface ActOptions {
  /** The screen shows its own message if this fails, so the generic error toast stays hidden. */
  quiet?: boolean;
}

export interface PlayerScreenProps {
  room: LobbyView;
  you: PlayerViewMessage['you'];
  /** The game's projection for this player. */
  game: unknown;
  /** Sends an action; resolves with the server's answer. */
  act: (action: unknown, opts?: ActOptions) => Promise<ActResult>;
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
  /** Host options the TV lobby shows, matching the game's optionsSchema. */
  options?: OptionField[];
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
  // ?debug=1 keeps reaching the plain-text screens in dev.
  cambio: {
    Host: CambioTv,
    HostDebug: CambioDebugHost,
    hostFullScreen: true,
    HostLobbyExtras: CambioLobbyExtras,
    Player: CambioPhone,
    fullScreen: true,
    Debug: CambioDebugPlayer,
    options: cambioOptionFields,
  },
  'tap-race': { Host: TapRaceHost, Player: TapRacePlayer },
};
