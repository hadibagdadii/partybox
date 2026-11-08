import { theme, type CambioHostView } from '@partybox/cambio';
import type { ReactNode } from 'react';
import type { HostScreenProps } from '../registry';
import { nameLookup, optionSummary } from './format';

/** Debug TV screen: Cambio's public view as plain text. */
export function CambioDebugHost({ game }: HostScreenProps) {
  const view = game as CambioHostView;
  const name = nameLookup(view);
  const between = view.phase === 'roundOver' || view.phase === 'over';
  const turn = view.turn;

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 text-2xl">
      <h1 className="text-4xl font-bold">
        {theme.title} · {theme.phases[view.phase]} · Round {view.round}
      </h1>
      <p className="text-lg text-slate-400">{optionSummary(view.options)}</p>

      {between && view.lastRound && (
        <Section title={`Round ${view.lastRound.round} results`}>
          {view.winners ? (
            <p className="text-4xl font-bold">{theme.results.gameWinner(view.winners.map(name))}</p>
          ) : (
            <p className="text-3xl font-bold">
              {theme.results.roundWinner(view.lastRound.winners.map(name))}
            </p>
          )}
          <ul data-testid="round-results" className="flex flex-col gap-1">
            {view.lastRound.hands.map((h) => (
              <li key={h.playerId}>
                {name(h.playerId)}
                {h.playerId === view.lastRound?.callerId && ` (${theme.actions.callCambio})`}:{' '}
                {theme.results.score(h.score)}
                {view.options.scoringMode === 'match' &&
                  ` · total ${view.lastRound?.totals[h.playerId] ?? 0}`}
                <span className="text-lg text-slate-400">
                  {' '}
                  {h.cards.map((c) => theme.cardName(c.face)).join(', ') || '-'}
                </span>
              </li>
            ))}
          </ul>
          {view.phase === 'roundOver' && (
            <p className="text-slate-400">Waiting for the VIP: {theme.actions.continue}</p>
          )}
        </Section>
      )}

      {!between && (
        <Section title="Table">
          <p>
            Discard: {view.topDiscard ? theme.cardName(view.topDiscard.face) : '-'} (
            {view.discardCount}) · Deck {view.deckCount}
          </p>
          {turn && (
            <p>
              {name(turn.playerId)}: {theme.stages[turn.stage]}
              {turn.power && ` · ${theme.powers[turn.power].name}`}
              {turn.drawnCardId && ' · holding a card'}
            </p>
          )}
          {view.callerId && (
            <p>
              {theme.actions.callCambio}: {name(view.callerId)}
              {view.lockedPlayerId && ` · ${theme.options.lockCaller.label}`}
            </p>
          )}
          {view.phase === 'peek' && <p>Ready: {view.readyIds.map(name).join(', ') || '-'}</p>}
        </Section>
      )}

      <Section title="Players">
        <ul data-testid="players" className="flex flex-col gap-1">
          {view.players.map((p) => (
            <li key={p.id}>
              {p.name}: {p.slots.length} cards
              {view.options.scoringMode === 'match' && ` · total ${view.totals[p.id] ?? 0}`}
              {turn?.playerId === p.id && ' ◀'}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Log">
        <ol className="flex flex-col-reverse gap-1 text-lg text-slate-300">
          {view.log.map((e, i) => (
            <li key={i}>{theme.describe(e, name)}</li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold text-slate-400">{title}</h2>
      {children}
    </section>
  );
}
