import {
  LOYAL_DECREES_TO_WIN,
  REBEL_DECREES_TO_WIN,
  UNREST_LIMIT,
  theme,
  type DiwanPlayerView,
} from '@partybox/diwan';
import type { Names } from '../format';
import { TeamMark } from '../ui/TeamMark';

/** Everything this player is allowed to know about allegiances: theirs, teammates, secrets. */
export function RoleDetails({ view, name }: { view: DiwanPlayerView; name: Names }) {
  const { you } = view;
  if (!you) return null;
  const teammates = Object.entries(view.knownRoles).filter(([id]) => id !== you.id);
  const { phone } = theme;
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm uppercase tracking-[0.2em] opacity-70">{phone.yourRole}</p>
      <p className="font-display text-5xl leading-none">{theme.roles[you.role]}</p>
      <p className="flex items-center gap-2 text-lg font-semibold">
        <TeamMark team={you.team} />
        {phone.yourTeam(theme.teams[you.team])}
      </p>
      <div className="w-full border-t border-court-gold/40 pt-3">
        <p className="mb-2 text-sm uppercase tracking-[0.2em] opacity-70">{phone.teammatesTitle}</p>
        {teammates.length === 0 ? (
          <p className="text-base opacity-80">{phone.noTeammates}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-lg">
            {teammates.map(([id, role]) => (
              <li key={id}>
                <span className="font-semibold">{name(id)}</span> · {theme.roles[role]}
              </li>
            ))}
          </ul>
        )}
      </div>
      {view.secrets.length > 0 && (
        <div className="w-full border-t border-court-gold/40 pt-3">
          <p className="mb-2 text-sm uppercase tracking-[0.2em] opacity-70">{phone.secretsTitle}</p>
          <ul className="flex flex-col gap-1 text-base">
            {view.secrets.map((s, i) => (
              <li key={i}>
                {s.type === 'investigate'
                  ? phone.spySecret(name(s.targetId), theme.teams[s.team])
                  : phone.scrollsSecret(s.cards.map((d) => theme.decrees[d]).join(', '))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Public tallies: decrees on each track and unrest. */
export function CourtStatus({ view }: { view: DiwanPlayerView }) {
  const items = [
    { decree: 'loyal' as const, value: view.enacted.loyal, max: LOYAL_DECREES_TO_WIN },
    { decree: 'rebel' as const, value: view.enacted.rebel, max: REBEL_DECREES_TO_WIN },
  ];
  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      {items.map(({ decree, value, max }) => (
        <div key={decree} className="rounded-card bg-court-dusk px-2 py-3">
          <dt className="flex items-center justify-center gap-1 text-xs text-court-mist">
            <TeamMark team={decree} size={16} />
            {theme.decrees[decree]}
          </dt>
          <dd className="text-2xl font-semibold">
            {value}/{max}
          </dd>
        </div>
      ))}
      <div className="rounded-card bg-court-dusk px-2 py-3">
        <dt className="text-xs text-court-mist">{theme.electionTracker}</dt>
        <dd className="text-2xl font-semibold">
          {view.unrest}/{UNREST_LIMIT}
        </dd>
      </div>
    </dl>
  );
}
