import type { DecreeId, OfficeId, PowerId, RoleId, TeamId, VoteId } from './ids.js';
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

/** Every player-facing Diwan string. Components and engine logic must not hardcode these. */
export const theme = {
  gameName: 'Diwan',
  teams: {
    loyal: 'Loyalists',
    rebel: 'Rebels',
  } satisfies Record<TeamId, string>,
  roles: {
    loyal: 'Loyalist',
    rebel: 'Rebel',
    usurper: 'The Usurper',
  } satisfies Record<RoleId, string>,
  offices,
  decrees: {
    loyal: 'Loyal Decree',
    rebel: 'Rebel Decree',
  } satisfies Record<DecreeId, string>,
  votes,
  electionTracker,
  chaos,
  powers: {
    investigate: 'Send a Spy',
    specialElection: 'Name a Successor',
    policyPeek: 'Read the Scrolls',
    execution: 'Exile',
  } satisfies Record<PowerId, string>,
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
  attribution:
    'Diwan is adapted from Secret Hitler by Max Temkin, Mike Boxleiter, Tommy Maranges, and Mackenzie Schubert, used under CC BY-NC-SA 4.0. Diwan is free and shared under the same license.',
} as const;
