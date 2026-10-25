import { teamOf, theme, type DiwanHostView } from '@partybox/diwan';
import { useEffect, useState } from 'react';
import type { Names } from '../../format';
import { StarRule } from '../../ornaments';
import { TeamMark } from '../../ui/TeamMark';
import { CardBack, FlipCard } from './FlipCard';

export const ROLE_STEP_MS = 900;

/** Winner, reason, then every role turned over one by one. Roles exist only once the game is over. */
export function GameOver({
  view,
  name,
  reduced,
}: {
  view: DiwanHostView;
  name: Names;
  reduced: boolean;
}) {
  const { winner, roles } = view;
  const total = view.players.length;
  const [shown, setShown] = useState(reduced ? total : 0);
  useEffect(() => {
    if (shown >= total) return;
    const t = setTimeout(
      () => setShown((n) => n + 1),
      shown === 0 ? ROLE_STEP_MS * 1.5 : ROLE_STEP_MS,
    );
    return () => clearTimeout(t);
  }, [shown, total]);

  if (!winner || !roles) return null;
  // One row up to seven players, two rows beyond; cards shrink to fit the stage.
  const cols = total <= 7 ? total : Math.ceil(total / 2);
  const width = Math.min(180, Math.floor((1300 - (cols - 1) * 16) / cols));
  const twoRows = cols < total;
  return (
    <section
      aria-label={theme.tv.gameOverTitle(theme.teams[winner.team])}
      className="flex h-full flex-col items-center justify-center gap-4"
    >
      <header className="flex flex-col items-center gap-2 text-center motion-safe:animate-drop-in">
        {!twoRows && <TeamMark team={winner.team} size={80} />}
        <h2 className="font-display text-tv-xl leading-none text-court-goldLight">
          {theme.tv.gameOverTitle(theme.teams[winner.team])}
        </h2>
        <StarRule />
      </header>
      <ul
        className="flex max-w-[1300px] flex-wrap justify-center gap-x-4 gap-y-2"
        aria-label={theme.tv.rolesTitle}
      >
        {view.players.map((p, i) => {
          const role = roles[p.id];
          if (!role) return null;
          const team = teamOf(role);
          return (
            <li key={p.id} className="flex flex-col items-center gap-1" style={{ width }}>
              <div className="w-full" style={{ height: twoRows ? 110 : 150 }}>
                <FlipCard
                  up={i < shown}
                  back={<CardBack />}
                  front={
                    <div
                      data-testid="role-card"
                      className={`flex h-full w-full flex-col items-center justify-center gap-2 rounded-card border-4 px-2 text-center ${
                        team === 'loyal'
                          ? 'border-court-gold bg-court-loyal text-court-loyalInk'
                          : 'border-court-indigoLight bg-court-rebel text-court-rebelInk'
                      }`}
                    >
                      <TeamMark team={team} size={48} />
                      <span className="font-serif text-tv-sm font-bold leading-none">
                        {theme.roles[role]}
                      </span>
                    </div>
                  }
                />
              </div>
              <span
                className={`max-w-full truncate text-tv-sm ${p.alive ? '' : 'text-court-mist line-through'}`}
              >
                {name(p.id)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
