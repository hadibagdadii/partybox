import { theme, type CambioAction, type CambioPlayerView } from '@partybox/cambio';
import { useState, type ReactNode } from 'react';
import type { PlayerScreenProps } from '../registry';
import { nameLookup, optionSummary, slotLookup } from './format';

type Of<T extends CambioAction['type']> = Extract<CambioAction, { type: T }>;
const SIMPLE = ['ready', 'draw', 'callCambio', 'discard', 'donePeek', 'skipPower'] as const;
type Simple = (typeof SIMPLE)[number];

/** Debug phone screen: what this player may know, and one button per legal action. */
export function CambioDebugPlayer({ game, act, you }: PlayerScreenProps) {
  const view = game as CambioPlayerView;
  const [giving, setGiving] = useState<string | null>(null);
  if (!view.you) return <p className="text-center text-xl">You are not in this game.</p>;
  const me = view.you.id;
  const name = nameLookup(view);
  const slot = slotLookup(view, me);
  const of = <T extends CambioAction['type']>(type: T) =>
    view.legalActions.filter((a): a is Of<T> => a.type === type);
  const send = (a: CambioAction) => {
    setGiving(null);
    void act(a);
  };

  const hand = view.players.find((p) => p.id === me)?.slots ?? [];
  const faces = new Map([...view.known, ...view.peeks].map((c) => [c.slotId, c] as const));
  const otherPeeks = view.peeks.filter((c) => c.playerId !== me);
  const turn = view.turn;
  const between = view.phase === 'roundOver' || view.phase === 'over';
  const simple = view.legalActions.filter((a): a is Of<Simple> =>
    (SIMPLE as readonly string[]).includes(a.type),
  );
  const canContinue = you.isVip && of('continue').length > 0;

  // Snaps on your own cards go straight in; another player's card asks which card to give.
  const snaps = of('snap');
  const snapTargets = [...new Map(snaps.map((s) => [s.slotId, s])).values()];
  const gives = giving ? snaps.filter((s) => s.slotId === giving && s.giveSlotId) : [];

  return (
    <div className="flex flex-col gap-4">
      <Section title="Round">
        <p>
          {theme.phases[view.phase]} · Round {view.round}
        </p>
        <p className="text-sm text-slate-400">{optionSummary(view.options)}</p>
        {turn && (
          <p>
            {turn.playerId === me ? 'You' : name(turn.playerId)}: {theme.stages[turn.stage]}
            {turn.power && ` · ${theme.powers[turn.power].name}`}
          </p>
        )}
        {view.topDiscard && <p>Discard: {theme.cardName(view.topDiscard.face)}</p>}
        {view.callerId && (
          <p>
            {theme.actions.callCambio}: {name(view.callerId)}
          </p>
        )}
      </Section>

      <Section title="Your cards">
        <ul data-testid="hand">
          {hand.map((s, i) => {
            const seen = faces.get(s.slotId);
            return (
              <li key={s.slotId}>
                #{i + 1}: {seen ? theme.cardName(seen.face) : 'face down'}
              </li>
            );
          })}
        </ul>
        {view.drawn && (
          <p className="text-xl font-bold">You drew: {theme.cardName(view.drawn.face)}</p>
        )}
        {otherPeeks.map((c) => (
          <p key={c.slotId} className="text-xl font-bold">
            {slot(c.slotId)}: {theme.cardName(c.face)}
          </p>
        ))}
      </Section>

      {between && view.lastRound && (
        <Section title={`Round ${view.lastRound.round} results`}>
          <p className="text-xl font-bold">
            {view.winners
              ? theme.results.gameWinner(view.winners.map(name))
              : theme.results.roundWinner(view.lastRound.winners.map(name))}
          </p>
          <ul>
            {view.lastRound.hands.map((h) => (
              <li key={h.playerId}>
                {name(h.playerId)}: {theme.results.score(h.score)}
                {view.options.scoringMode === 'match' &&
                  ` · total ${view.lastRound?.totals[h.playerId] ?? 0}`}
              </li>
            ))}
          </ul>
          {view.phase === 'roundOver' && !you.isVip && (
            <p className="text-slate-400">Waiting for the VIP to start the next round.</p>
          )}
        </Section>
      )}

      {canContinue && (
        <ActionButton onClick={() => send({ type: 'continue' })}>
          {theme.actions.continue}
        </ActionButton>
      )}
      {simple.map((a) => (
        <ActionButton key={a.type} onClick={() => send(a)}>
          {a.type === 'skipPower' && turn?.stage === 'kingDecide'
            ? theme.actions.keep
            : theme.actions[a.type]}
        </ActionButton>
      ))}

      <Group title={theme.actions.swap} actions={of('swap')}>
        {(a) => (
          <ActionButton key={a.slotId} onClick={() => send(a)}>
            {theme.actions.swap}: {slot(a.slotId)}
          </ActionButton>
        )}
      </Group>
      <Group title={turn?.power ? theme.powers[turn.power].name : ''} actions={of('peek')}>
        {(a) => (
          <ActionButton key={a.slotId} onClick={() => send(a)}>
            {slot(a.slotId)}
          </ActionButton>
        )}
      </Group>
      <Group title={turn?.power ? theme.powers[turn.power].name : ''} actions={of('blindSwap')}>
        {(a) => (
          <ActionButton key={a.slotIds.join()} onClick={() => send(a)}>
            {slot(a.slotIds[0])} ↔ {slot(a.slotIds[1])}
          </ActionButton>
        )}
      </Group>
      <Group title={theme.actions.kingSwap} actions={of('kingSwap')}>
        {(a) => (
          <ActionButton key={a.slotId} onClick={() => send(a)}>
            {theme.actions.kingSwap}: {slot(a.slotId)}
          </ActionButton>
        )}
      </Group>

      {giving ? (
        <Section title={`${theme.actions.snap} ${slot(giving)}: ${theme.errors.giveRequired}`}>
          <div className="flex flex-col gap-2">
            {gives.map((a) => (
              <ActionButton key={a.giveSlotId} onClick={() => send(a)}>
                {slot(a.giveSlotId!)}
              </ActionButton>
            ))}
            <ActionButton onClick={() => setGiving(null)}>Cancel</ActionButton>
          </div>
        </Section>
      ) : (
        <Group title={theme.actions.snap} actions={snapTargets}>
          {(a) => (
            <ActionButton
              key={a.slotId}
              onClick={() => (a.giveSlotId ? setGiving(a.slotId) : send(a))}
            >
              {theme.actions.snap} {slot(a.slotId)}
            </ActionButton>
          )}
        </Group>
      )}

      {view.legalActions.length === 0 && (
        <p className="text-center text-slate-400">Nothing to do right now.</p>
      )}
    </div>
  );
}

function Group<A>({
  title,
  actions,
  children,
}: {
  title: string;
  actions: A[];
  children: (a: A) => ReactNode;
}) {
  if (actions.length === 0) return null;
  return (
    <Section title={title}>
      <div className="flex flex-col gap-2">{actions.map(children)}</div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-sm uppercase text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-14 w-full rounded-xl bg-slate-700 px-4 text-xl active:bg-slate-600"
    >
      {children}
    </button>
  );
}
