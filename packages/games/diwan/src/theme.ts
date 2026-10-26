import type { DecreeId, OfficeId, PowerId, RoleId, TeamId, VoteId } from './ids.js';
import {
  LEGISLATIVE_DRAW,
  LOYAL_DECREES_TO_WIN,
  MAX_PLAYERS,
  MIN_PLAYERS,
  REBEL_DECREES_TO_WIN,
  UNREST_LIMIT,
  USURPER_ELECTION_THRESHOLD,
  VETO_UNLOCK,
} from './rules.js';
import type { Phase, WinReason } from './state.js';

export interface VoteLabel {
  label: string;
  /** English gloss shown under the label. */
  subtitle: string;
}

const offices = {
  ameer: 'Ameer',
  wazir: 'Wazir',
} satisfies Record<OfficeId, string>;

const votes = {
  yes: { label: "Na'am", subtitle: 'Yes' },
  no: { label: 'Laa', subtitle: 'No' },
} satisfies Record<VoteId, VoteLabel>;

const electionTracker = 'Unrest';
const chaos = 'Riot';
const veto = 'Joint Veto';
const teams = { loyal: 'Loyalists', rebel: 'Rebels' } satisfies Record<TeamId, string>;
const usurper = 'The Usurper';
const powers = {
  investigate: 'Send a Spy',
  specialElection: 'Name a Successor',
  policyPeek: 'Read the Scrolls',
  execution: 'Exile',
} satisfies Record<PowerId, string>;

export interface TutorialSlide {
  title: string;
  /** Shown on the TV slide and in the phone's rules summary. */
  body: string;
  /** One short line the herald reads aloud; also the caption. */
  herald: string;
}

/** The seven tutorial topics, in order. The phone's rules summary reuses them. */
const tutorialSlides: readonly TutorialSlide[] = [
  {
    title: 'Two sides, one secret',
    body: `Most of the court are ${teams.loyal}. A few are ${teams.rebel}, and one of them is ${usurper}. The ${teams.rebel} know each other; in larger courts ${usurper} does not know them. The ${teams.loyal} know no one.`,
    herald: `${teams.loyal}, ${teams.rebel}, and one hidden Usurper.`,
  },
  {
    title: `The ${offices.ameer} and the ${offices.wazir}`,
    body: `Each round the title of ${offices.ameer} passes to the next courtier. The ${offices.ameer} nominates a ${offices.wazir}. The courtiers who just governed cannot be nominated as ${offices.wazir} straight away.`,
    herald: `The ${offices.ameer} names a ${offices.wazir} each round.`,
  },
  {
    title: `${votes.yes.label} or ${votes.no.label}`,
    body: `Everyone votes at once: ${votes.yes.label} means yes, ${votes.no.label} means no. If more than half say ${votes.yes.label}, the pair govern. A tie fails.`,
    herald: `Vote ${votes.yes.label} for yes, ${votes.no.label} for no.`,
  },
  {
    title: 'Passing a decree',
    body: `The ${offices.ameer} draws ${LEGISLATIVE_DRAW} decrees, discards 1 in secret, and hands 2 to the ${offices.wazir}. The ${offices.wazir} enacts 1. No one else sees the cards, so anyone may lie about them.`,
    herald: `The ${offices.ameer} discards one. The ${offices.wazir} enacts one.`,
  },
  {
    title: `${electionTracker} and ${chaos}s`,
    body: `Every failed vote raises ${electionTracker}. At ${UNREST_LIMIT}, a ${chaos} breaks out: the top decree is enacted with no power, and ${electionTracker} resets.`,
    herald: `Three failed votes, and the people ${chaos.toLowerCase()}.`,
  },
  {
    title: 'Royal powers',
    body: `Some Rebel Decrees give the ${offices.ameer} a power: ${powers.investigate}, ${powers.specialElection}, ${powers.policyPeek}, or ${powers.execution}. After ${VETO_UNLOCK} Rebel Decrees, the ${offices.wazir} may propose a ${veto}.`,
    herald: 'Rebel Decrees grant royal powers.',
  },
  {
    title: 'How to win',
    body: `The ${teams.loyal} win with ${LOYAL_DECREES_TO_WIN} Loyal Decrees, or by exiling ${usurper}. The ${teams.rebel} win with ${REBEL_DECREES_TO_WIN} Rebel Decrees, or by making ${usurper} ${offices.wazir} once ${USURPER_ELECTION_THRESHOLD} Rebel Decrees are enacted.`,
    herald: 'Trust carefully. The court is watching.',
  },
];

/** Every player-facing Diwan string. Components and engine logic must not hardcode these. */
export const theme = {
  gameName: 'Diwan',
  teams,
  roles: {
    loyal: 'Loyalist',
    rebel: 'Rebel',
    usurper,
  } satisfies Record<RoleId, string>,
  offices,
  decrees: {
    loyal: 'Loyal Decree',
    rebel: 'Rebel Decree',
  } satisfies Record<DecreeId, string>,
  votes,
  electionTracker,
  chaos,
  powers,
  veto,
  phases: {
    reveal: 'Role reveal',
    nominate: 'Nomination',
    vote: 'Vote',
    ameerDiscard: 'Ameer discards',
    wazirEnact: 'Wazir enacts',
    vetoPending: 'Veto proposed',
    power: 'Executive power',
    over: 'Game over',
  } satisfies Record<Phase, string>,
  actions: {
    acknowledge: 'I have seen my role',
    nominate: 'Nominate as Wazir',
    ameerDiscard: 'Discard',
    wazirEnact: 'Enact',
    proposeVeto: 'Propose a Joint Veto',
    acceptVeto: 'Accept the veto',
    refuseVeto: 'Refuse the veto',
    policyPeekDone: 'Done reading',
  },
  winReasons: {
    loyalDecrees: 'Five Loyal Decrees were enacted',
    usurperExiled: 'The Usurper was exiled',
    rebelDecrees: 'Six Rebel Decrees were enacted',
    usurperElected: 'The Usurper was made Wazir',
  } satisfies Record<WinReason, string>,
  /** Phone screen copy. Templates take names that are already looked up. */
  phone: {
    lobbyTitle: 'The court assembles',
    lobbyCount: (n: number) => `${n} at court`,
    lobbyNeed: (n: number) => `${n} more needed`,
    start: 'Open the court',
    waitingForVip: 'Waiting for the host to open the court…',
    waitingForPlayers: 'Waiting for more courtiers…',
    backToLobby: 'Back to the lobby',
    you: 'you',
    host: 'Host',
    myRole: 'My role',
    holdToReveal: 'Press and hold to break the seal',
    holdToPeek: 'Hold',
    releaseToHide: 'Release to hide',
    yourRole: 'You are',
    yourTeam: (team: string) => `You serve the ${team}`,
    teammatesTitle: 'You know',
    noTeammates: 'You know no one’s allegiance but your own.',
    secretsTitle: 'Your secrets',
    spySecret: (target: string, team: string) => `${target} serves the ${team}.`,
    scrollsSecret: (cards: string) => `You read: ${cards}.`,
    acknowledge: 'I’ve seen my role',
    courtRecord: 'Court record',
    close: 'Close',
    emptyLog: 'Nothing has happened yet.',
    confirm: 'Confirm',
    cancel: 'Back',
    nominateTitle: `Choose your ${offices.wazir}`,
    nominateHint: 'Tap a courtier, then confirm.',
    voteTitle: (ameer: string, wazir: string) => `Should ${ameer} and ${wazir} govern?`,
    voteYours: (label: string) => `Your vote: ${label}. You can change it until all have voted.`,
    voteNone: 'You have not voted yet.',
    discardTitle: 'Discard one decree',
    discardHint: `The other two go to your ${offices.wazir}.`,
    enactTitle: 'Enact one decree',
    enactHint: 'The other is discarded.',
    vetoAnswerTitle: (wazir: string) => `${wazir} proposes a ${veto}`,
    vetoAnswerHint: `If you accept, both decrees are discarded and ${electionTracker} rises.`,
    powerTitle: (power: string) => power,
    powerHints: {
      investigate: 'Learn one courtier’s allegiance. Only you will see it.',
      specialElection: `Choose who will be the next ${offices.ameer}.`,
      execution: 'Exile one courtier from the court forever.',
    },
    exileSure: (target: string) => `Exile ${target}? This cannot be undone.`,
    exileYes: 'Yes, exile them',
    spyResultTitle: 'Your spy returns',
    done: 'Done',
    scrollsTitle: 'The next three decrees',
    scrollsHint: 'Only you can see these. They stay in this order.',
    waitingTitle: 'The court deliberates',
    waiting: {
      reveal: (names: string) => `Waiting for ${names} to read their roles.`,
      nominate: (names: string) => `${names} is choosing a ${offices.wazir}.`,
      vote: (names: string) => `Waiting for ${names} to vote.`,
      ameerDiscard: (names: string) => `${names} is reviewing three decrees.`,
      wazirEnact: (names: string) => `${names} is choosing a decree to enact.`,
      vetoPending: (names: string) => `${names} is considering the ${veto}.`,
      power: (names: string) => `${names} is using a royal power.`,
      over: () => 'The game is over.',
    },
    officeTag: { ameer: offices.ameer, nominee: `${offices.wazir} nominee` },
    exiledBanner: 'You have been exiled',
    exiledHint: 'You may watch, but you can no longer vote or speak for the court.',
    gameOverTitle: (team: string) => `The ${team} prevail`,
    rolesTitle: 'Every allegiance',
    exiledTag: 'exiled',
    playAgain: 'Play again',
    leaveRoom: 'Leave the room',
    leaveSure: 'Leave the room?',
    leaveYes: 'Yes, leave',
    about: 'About',
    rulesTab: 'Rules',
    recordTab: 'Court record',
    startChoice: 'How shall the court begin?',
  },
  /** Public log sentences. */
  log: {
    nominated: (ameer: string, wazir: string) => `${ameer} nominated ${wazir} as ${offices.wazir}.`,
    votesRevealed: (passed: boolean, yes: string, no: string) =>
      `The vote ${passed ? 'passed' : 'failed'}. ${votes.yes.label}: ${yes}. ${votes.no.label}: ${no}.`,
    nobody: 'nobody',
    unrest: (level: number) => `${electionTracker} rises to ${level}.`,
    riot: (decree: string) => `A ${chaos} breaks out, and a ${decree} is enacted.`,
    enacted: (ameer: string, wazir: string, decree: string) =>
      `${ameer} and ${wazir} enacted a ${decree}.`,
    reshuffled: (count: number) => `The deck is reshuffled with ${count} decrees.`,
    vetoProposed: (wazir: string) => `${wazir} proposed a ${veto}.`,
    vetoAnswered: (ameer: string, accept: boolean) =>
      `${ameer} ${accept ? 'accepted' : 'refused'} the ${veto}.`,
    powerUsed: (ameer: string, power: string, target: string | null) =>
      target ? `${ameer} used ${power} on ${target}.` : `${ameer} used ${power}.`,
    exiled: (target: string) => `${target} has been exiled.`,
    gameOver: (team: string, reason: string) => `The ${team} win. ${reason}.`,
  },
  /** TV (host screen) copy. Templates take names that are already looked up. */
  tv: {
    instruction: {
      reveal: () => 'Read your scroll in secret',
      nominate: (ameer: string) => `${ameer}, choose your ${offices.wazir}`,
      vote: (ameer: string, wazir: string) => `Should ${ameer} and ${wazir} govern? Vote now`,
      ameerDiscard: (ameer: string) => `${ameer} reviews three decrees`,
      wazirEnact: (wazir: string) => `${wazir} chooses a decree to enact`,
      vetoPending: (ameer: string, wazir: string) =>
        `${wazir} proposes a ${veto}. ${ameer} decides`,
      power: {
        investigate: (ameer: string) => `${ameer}, choose a courtier to spy on`,
        specialElection: (ameer: string) => `${ameer}, name the next ${offices.ameer}`,
        policyPeek: (ameer: string) => `${ameer} reads the next three decrees`,
        execution: (ameer: string) => `${ameer}, choose a courtier to exile`,
      } satisfies Record<PowerId, (ameer: string) => string>,
    },
    loyalTrack: 'Loyal Decrees',
    rebelTrack: 'Rebel Decrees',
    draw: 'Draw',
    discard: 'Discard',
    vetoSlot: veto,
    vetoUnlocked: `${veto} unlocked`,
    winSlot: 'Victory',
    waitingOn: 'Waiting on',
    away: 'away',
    exiled: 'exiled',
    termLimit: 'last term',
    courtRecord: 'Court record',
    voteTally: (passed: boolean, yes: number, no: number) =>
      `${passed ? 'Passed' : 'Failed'} ${yes}–${no}`,
    riotTag: chaos,
    exileBanner: (target: string) => `${target} is exiled`,
    nightTitle: 'Night falls on the court',
    nightHint: 'Look at your scroll in secret, and remember who you can trust.',
    gameOverTitle: (team: string) => `The ${team} prevail`,
    rolesTitle: 'Every allegiance',
    settings: 'Settings',
    heraldEnable: 'Enable the herald',
    heraldReady: 'The herald is ready',
    heraldMute: 'Mute the herald',
    heraldVoice: 'Herald voice',
    heraldDefaultVoice: 'Default voice',
    newRoom: 'New room',
    endGame: 'End game',
    endGameSure: 'End the game for everyone? Roles stay secret and the court returns to the lobby.',
    endGameYes: 'Yes, end the game',
    cancel: 'Cancel',
    about: 'About',
    awayPrompt: (names: string) =>
      `${names} has been away for a while. You can wait for them, or end the game.`,
    awayWait: 'Wait',
    voteSr: (name: string, label: string, subtitle: string) =>
      `${name} voted ${label} (${subtitle})`,
  },
  /** Lobby tutorial: seven slides on the TV, driven from the VIP's phone. */
  tutorial: {
    slides: tutorialSlides,
    startWith: 'Start with tutorial',
    startNow: 'Start now',
    next: 'Next',
    back: 'Back',
    skip: 'Skip',
    begin: 'Start game',
    watchTv: 'Watch the TV',
    watchTvHint: 'The host is walking the court through the rules.',
    progress: (n: number, total: number) => `${n} of ${total}`,
    title: 'How to play',
  },
  /** The phone's rules summary, built from the tutorial slides. */
  rules: {
    title: 'Rules',
  },
  /** Court record: short, round-grouped summaries shared by the TV log and the phone. */
  record: {
    round: (n: number) => `Round ${n}`,
    nominated: (ameer: string, wazir: string) => `${offices.ameer} ${ameer} nominated ${wazir}`,
    vote: (passed: boolean, yes: number, no: number) =>
      `${passed ? 'Passed' : 'Failed'} ${yes}-${no}`,
    unrest: (level: number, limit: number) => `${electionTracker} ${level}/${limit}`,
    riot: (decree: string) => `${chaos}: ${decree} enacted`,
    enacted: (decree: string) => `${decree} enacted`,
    reshuffled: (count: number) => `Deck reshuffled (${count})`,
    vetoProposed: (wazir: string) => `${wazir} proposed a ${veto}`,
    vetoAnswered: (ameer: string, accept: boolean) =>
      `${ameer} ${accept ? 'accepted' : 'refused'} the ${veto}`,
    power: (power: string, target: string | null) => (target ? `${power}: ${target}` : power),
    exiled: (target: string) => `${target} exiled`,
    gameOver: (team: string) => `The ${team} win`,
  },
  /** Spoken by the court herald. Short, public, and never more than the log says. */
  herald: {
    night: 'The court falls silent. Look at your scroll, and remember who you can trust.',
    nominated: (ameer: string, wazir: string) => `${ameer} names ${wazir} as ${offices.wazir}.`,
    /** Result and tally only; names stay on screen. */
    vote: (passed: boolean, yes: string, no: string) =>
      `The vote ${passed ? 'passes' : 'fails'}, ${yes} to ${no}.`,
    numbers: [
      'none',
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'ten',
    ],
    riot: (decree: string) => `${chaos}! The people rise, and a ${decree} is enacted.`,
    enacted: (decree: string) => `A ${decree} is enacted.`,
    powerUsed: (ameer: string, power: string, target: string | null) =>
      target ? `${ameer} uses ${power} on ${target}.` : `${ameer} uses ${power}.`,
    exiled: (target: string) => `${target} is exiled from the court.`,
    gameOver: (team: string, reason: string) => `The ${team} prevail. ${reason}.`,
  },
  landing: {
    title: 'Diwan',
    pitch:
      "A hidden-role game of loyalty and betrayal in the Sultan's court. One screen everyone can see, everyone plays on their phone.",
    host: 'Host a game',
    hostNote: 'Open this on a TV or laptop the whole group can see.',
    join: 'Join a game',
    joinButton: 'Join',
    howItWorks: 'How it works',
    steps: [
      'Open Diwan on a TV or laptop and host a game.',
      'Everyone scans the QR code or enters the room code on their phone.',
      'Play: the court gathers on the big screen, secrets stay on your phone.',
    ],
    players: `${MIN_PLAYERS} to ${MAX_PLAYERS} players`,
    about: 'About',
  },
  about: {
    title: 'About Diwan',
    attribution:
      'Diwan is adapted from Secret Hitler by Max Temkin, Mike Boxleiter, Tommy Maranges, and Mackenzie Schubert, licensed under CC BY-NC-SA 4.0. This adaptation is free and shared under the same license.',
    licenseLink: 'Read the CC BY-NC-SA 4.0 license',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    licenseFileLabel: 'License file in the source:',
    licenseFile: 'packages/games/diwan/LICENSE',
    free: 'No ads. No paid features.',
    back: 'Back',
  },
} as const;
