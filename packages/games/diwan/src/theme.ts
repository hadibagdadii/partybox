import type { DecreeId, OfficeId, PowerId, RoleId, TeamId, VoteId } from './ids.js';
import type { Phase, WinReason } from './state.js';

export interface VoteLabel {
  label: string;
  /** English gloss shown under the label. */
  subtitle: string;
}

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
  offices: {
    ameer: 'Ameer',
    wazir: 'Wazir',
  } satisfies Record<OfficeId, string>,
  decrees: {
    loyal: 'Loyal Decree',
    rebel: 'Rebel Decree',
  } satisfies Record<DecreeId, string>,
  votes: {
    yes: { label: "Na'am", subtitle: 'Yes' },
    no: { label: 'Laa', subtitle: 'No' },
  } satisfies Record<VoteId, VoteLabel>,
  electionTracker: 'Unrest',
  chaos: 'Riot',
  powers: {
    investigate: 'Send a Spy',
    specialElection: 'Name a Successor',
    policyPeek: 'Read the Scrolls',
    execution: 'Exile',
  } satisfies Record<PowerId, string>,
  veto: 'Joint Veto',
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
  attribution:
    'Diwan is adapted from Secret Hitler by Max Temkin, Mike Boxleiter, Tommy Maranges, and Mackenzie Schubert, used under CC BY-NC-SA 4.0. Diwan is free and shared under the same license.',
} as const;
