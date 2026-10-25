import {
  LOYAL_DECREES_TO_WIN,
  REBEL_DECREES_TO_WIN,
  UNREST_LIMIT,
  theme,
  type DiwanHostView,
} from '@partybox/diwan';
import type { HostScreenProps } from '../registry';
import { formatLog, nameLookup } from './format';

/** Debug TV screen: public state as plain text, shown in dev with ?debug=1. */
export function DiwanDebugHost({ game }: HostScreenProps) {
  const view = game as DiwanHostView;
  const name = nameLookup(view.players);
  const track = view.powerTrack.map((p, i) => `${i + 1}:${p ? theme.powers[p] : '-'}`).join('  ');

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 text-2xl">
      <h1 className="text-4xl font-bold">
        {theme.gameName} · {theme.phases[view.phase]}
      </h1>

      <section className="flex flex-col gap-1">
        <p>
          {theme.decrees.loyal}: {view.enacted.loyal}/{LOYAL_DECREES_TO_WIN}
        </p>
        <p>
          {theme.decrees.rebel}: {view.enacted.rebel}/{REBEL_DECREES_TO_WIN}
        </p>
        <p className="text-lg text-slate-400">Powers: {track}</p>
        <p>
          {theme.electionTracker}: {view.unrest}/{UNREST_LIMIT}
        </p>
        <p className="text-lg text-slate-400">
          Draw {view.drawCount} · Discard {view.discardCount}
          {view.vetoUnlocked && ` · ${theme.veto} unlocked`}
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <p>
          {theme.offices.ameer}: {name(view.ameerId)}
        </p>
        <p>
          {theme.offices.wazir} nominee: {name(view.nomineeId)}
        </p>
        {view.lastElected && (
          <p className="text-lg text-slate-400">
            Last elected: {name(view.lastElected.ameerId)} / {name(view.lastElected.wazirId)}
          </p>
        )}
        {view.pendingPower && <p>Power: {theme.powers[view.pendingPower]}</p>}
        {view.phase === 'reveal' && (
          <p>Seen their role: {view.acknowledgedIds.map(name).join(', ') || '-'}</p>
        )}
        {view.phase === 'vote' && <p>Voted: {view.votedIds.map(name).join(', ') || '-'}</p>}
        <p className="text-lg text-slate-400">
          Exiled:{' '}
          {view.players
            .filter((p) => !p.alive)
            .map((p) => p.name)
            .join(', ') || '-'}
        </p>
      </section>

      {view.winner && (
        <section className="flex flex-col gap-1">
          <p className="text-4xl font-bold">
            {theme.teams[view.winner.team]} win: {theme.winReasons[view.winner.reason]}
          </p>
          {view.roles && (
            <ul>
              {view.players.map((p) => (
                <li key={p.id}>
                  {p.name}: {theme.roles[view.roles![p.id]!]}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold">Log</h2>
        <ol className="flex flex-col-reverse gap-1 text-lg text-slate-300">
          {view.log.map((entry, i) => (
            <li key={i}>{formatLog(entry, name)}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
