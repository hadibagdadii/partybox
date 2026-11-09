import { cambioModule, theme as cambio } from '@partybox/cambio';
import { diwanModule, theme as diwan } from '@partybox/diwan';

export interface GameListing {
  id: string;
  name: string;
  players: string;
  pitch: string;
}

const players = (min: number, max: number) => `${min} to ${max} players`;

/** Every game Partybox can list, in picker order. Each game writes its own one-line pitch. */
export const games: readonly GameListing[] = [
  {
    id: diwanModule.id,
    name: diwanModule.displayName,
    players: players(diwanModule.minPlayers, diwanModule.maxPlayers),
    pitch: diwan.pitch,
  },
  {
    id: cambioModule.id,
    name: cambioModule.displayName,
    players: players(cambioModule.minPlayers, cambioModule.maxPlayers),
    pitch: cambio.tagline,
  },
];

/** Platform-wide words: landing, join, host lobby, About. Game copy lives in each game's theme. */
export const partybox = {
  name: 'Partybox',
  landing: {
    pitch: 'Party games for one big screen and everyone’s phones.',
    host: 'Host a game',
    hostNote: 'Open this on a TV or laptop the whole group can see.',
    join: 'Join a game',
    joinButton: 'Join',
    codeLabel: 'Room code',
    codePlaceholder: 'CODE',
    games: 'Games',
    howItWorks: 'How it works',
    steps: [
      'Host a game on a TV or laptop.',
      'Everyone scans the QR code or types the room code on their phone.',
      'Play together on the big screen. Anything secret stays on your phone.',
    ],
    about: 'About Partybox',
  },
  join: {
    title: 'Join a game',
    code: 'Room code',
    name: 'Your name',
    room: 'Room',
    change: 'Change',
    join: 'Join',
    joining: 'Joining…',
    rejoining: (code: string) => `Rejoining ${code}…`,
    connecting: 'Connecting to the server…',
    reconnecting: 'Reconnecting…',
    removed: 'You were removed from the room',
    joinAnother: 'Join a game',
    about: 'About',
  },
  lobby: {
    youreIn: "You're in!",
    joined: (n: number) => `${n} ${n === 1 ? 'player' : 'players'} joined`,
    needMore: (n: number) => `Need ${n} more`,
    start: 'Start game',
    startWithTutorial: 'Start with tutorial',
    startNow: 'Skip tutorial and start',
    waitingForMore: 'Waiting for more players…',
    waitingForVip: 'Waiting for the VIP to start…',
    leave: 'Leave room',
    playAgain: 'Play again',
    backToLobby: 'Back to lobby',
    vip: 'VIP',
  },
  host: {
    title: 'Host screen',
    create: 'Create room',
    reconnectingTo: (code: string) => `Reconnecting to ${code}…`,
    connecting: 'Connecting to the server…',
    reconnecting: 'Reconnecting…',
    roomCode: 'Room code',
    scan: 'Scan to join',
    orGoTo: 'Or go to',
    andEnter: 'and enter',
    game: 'Game',
    players: (n: number, max: number) => `${n}/${max} players`,
    needMore: (n: number) => `Need ${n} more`,
    waitingForVip: 'Waiting for the VIP to start',
    waitingOn: 'Waiting on',
    disconnected: 'Disconnected',
    bot: 'Bot',
    remove: (name: string) => `Remove ${name}`,
    removeConfirm: (name: string) => `Remove ${name} from the room?`,
    removeYes: 'Remove',
    cancel: 'Cancel',
    newRoom: 'New room',
  },
  about: {
    title: 'About Partybox',
    intro:
      'Partybox is a free set of party games. One screen everyone can see, and everyone plays on their phone.',
    back: 'Back',
  },
} as const;
