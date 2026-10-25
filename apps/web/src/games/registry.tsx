import type { LobbyView, PlayerViewMessage } from '@partybox/shared';
import type { ComponentType } from 'react';
import { DiwanHost } from './diwan/DiwanHost';
import { DiwanPlayer } from './diwan/DiwanPlayer';
import { TapRaceHost, TapRacePlayer } from './tap-race/TapRace';

export interface HostScreenProps {
  room: LobbyView;
  /** The game's host projection; each screen knows its own shape. */
  game: unknown;
}

export interface PlayerScreenProps {
  room: LobbyView;
  you: PlayerViewMessage['you'];
  /** The game's projection for this player. */
  game: unknown;
  act: (action: unknown) => void;
}

export interface GameScreens {
  Host: ComponentType<HostScreenProps>;
  Player: ComponentType<PlayerScreenProps>;
}

export const gameScreens: Record<string, GameScreens> = {
  diwan: { Host: DiwanHost, Player: DiwanPlayer },
  'tap-race': { Host: TapRaceHost, Player: TapRacePlayer },
};
