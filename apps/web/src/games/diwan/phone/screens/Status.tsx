import { teamOf, theme } from '@partybox/diwan';
import { listNames } from '../../format';
import { Rosette12, Star8 } from '../ornaments';
import { CourtStatus, LogList, TeamMark } from '../RoleDetails';
import type { ScreenProps } from '../screen';
import { Button, Frame, Title } from '../ui';

/** Nothing to do: say what is happening and whose turn it is, with a slow breathing star. */
export function WaitingScreen({ view, name }: ScreenProps) {
  const others = view.waitingOn.filter((id) => id !== view.you?.id).map(name);
  const line = theme.phone.waiting[view.phase](listNames(others));
  return (
    <Frame>
      <Title>{theme.phases[view.phase]}</Title>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4">
        <div className="relative flex items-center justify-center text-court-gold">
          <Rosette12 size={160} className="opacity-70 motion-safe:animate-spin-slow" />
          <Star8 size={44} className="absolute text-court-goldLight motion-safe:animate-breathe" />
        </div>
        <p className="text-center text-2xl" aria-live="polite">
          {line}
        </p>
        {view.pendingPower && (
          <p className="text-lg text-court-mist">{theme.powers[view.pendingPower]}</p>
        )}
      </div>
      <CourtStatus view={view} />
    </Frame>
  );
}

/** Spectator view for an exiled player. */
export function ExiledScreen({ view, name }: ScreenProps) {
  return (
    <Frame>
      <div
        role="status"
        className="rounded-card border-2 border-court-danger bg-court-danger/20 px-4 py-5 text-center"
      >
        <p className="font-display text-4xl text-court-parchment">{theme.phone.exiledBanner}</p>
        <p className="mt-2 text-base text-court-mist">{theme.phone.exiledHint}</p>
      </div>
      <p className="text-center text-lg text-court-mist">
        {theme.phone.waiting[view.phase](listNames(view.waitingOn.map(name)))}
      </p>
      <CourtStatus view={view} />
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl text-court-goldLight">{theme.phone.courtRecord}</h2>
        <LogList view={view} name={name} />
      </section>
    </Frame>
  );
}

/** Winner, reason, and every player's role. */
export function GameOverScreen({
  view,
  name,
  reset,
}: Pick<ScreenProps, 'view' | 'name'> & { reset: (() => void) | null }) {
  const { winner, roles } = view;
  return (
    <Frame actions={reset && <Button onClick={reset}>{theme.phone.backToLobby}</Button>}>
      {winner && (
        <header className="flex flex-col items-center gap-3 text-center">
          <TeamMark team={winner.team} size={64} />
          <h1 className="font-display text-4xl text-court-goldLight">
            {theme.phone.gameOverTitle(theme.teams[winner.team])}
          </h1>
          <p className="text-xl">{theme.winReasons[winner.reason]}</p>
        </header>
      )}
      {roles && (
        <section className="flex flex-col gap-2">
          <h2 className="text-center text-sm uppercase tracking-[0.2em] text-court-mist">
            {theme.phone.rolesTitle}
          </h2>
          <ul className="flex flex-col gap-2">
            {view.players.map((p) => {
              const role = roles[p.id];
              if (!role) return null;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-card px-4 py-3 ${
                    p.id === view.you?.id ? 'bg-court-indigo' : 'bg-court-dusk'
                  }`}
                >
                  <TeamMark team={teamOf(role)} />
                  <span className="min-w-0 flex-1 truncate text-xl">
                    {name(p.id)}
                    {p.id === view.you?.id && ` (${theme.phone.you})`}
                  </span>
                  <span className="text-right text-base">
                    {theme.roles[role]}
                    {!p.alive && (
                      <span className="block text-xs uppercase text-court-mist">
                        {theme.phone.exiledTag}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Frame>
  );
}
