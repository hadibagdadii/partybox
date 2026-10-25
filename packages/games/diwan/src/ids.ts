/** Neutral engine ids. Player-facing names live in theme.ts. */
export const TEAM_IDS = ['loyal', 'rebel'] as const;
export type TeamId = (typeof TEAM_IDS)[number];

export const ROLE_IDS = ['loyal', 'rebel', 'usurper'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const OFFICE_IDS = ['ameer', 'wazir'] as const;
export type OfficeId = (typeof OFFICE_IDS)[number];

export const DECREE_IDS = ['loyal', 'rebel'] as const;
export type DecreeId = (typeof DECREE_IDS)[number];
