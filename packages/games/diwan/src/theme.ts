import type { DecreeId, OfficeId, RoleId, TeamId } from './ids.js';

/** Every player-facing Diwan string. Components and engine logic must not hardcode these. */
export const theme = {
  gameName: 'Diwan',
  tagline: 'Intrigue in the court of the caliph.',
  teams: {
    loyal: 'The Loyal Court',
    rebel: 'The Conspirators',
  } satisfies Record<TeamId, string>,
  roles: {
    loyal: 'Loyal Courtier',
    rebel: 'Conspirator',
    usurper: 'The Usurper',
  } satisfies Record<RoleId, string>,
  offices: {
    ameer: 'Ameer',
    wazir: 'Wazir',
  } satisfies Record<OfficeId, string>,
  decrees: {
    loyal: 'Decree of Justice',
    rebel: 'Decree of Treachery',
  } satisfies Record<DecreeId, string>,
  attribution:
    'Diwan is adapted from Secret Hitler by Max Temkin, Mike Boxleiter, Tommy Maranges, and Mackenzie Schubert, used under CC BY-NC-SA 4.0. Diwan is free and shared under the same license.',
} as const;
