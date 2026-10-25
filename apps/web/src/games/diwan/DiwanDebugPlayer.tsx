import { theme, type DiwanAction, type DiwanPlayerView } from '@partybox/diwan';
import type { ReactNode } from 'react';
import type { PlayerScreenProps } from '../registry';
import { nameLookup, type Names } from './format';

type TargetAction = Extract<DiwanAction, { targetId: string }>;
type TargetType = TargetAction['type'];

const isTargeted = (a: DiwanAction): a is TargetAction => 'targetId' in a;

/** Debug phone screen: everything this player may know, and one button per legal action. */
export function DiwanDebugPlayer({ game, act }: PlayerScreenProps) {
  const view = game as DiwanPlayerView;
  const name = nameLookup(view.players);
  const { you } = view;
  if (!you) return <p className="text-center text-xl">You are not in this game.</p>;

  const teammates = Object.entries(view.knownRoles).filter(([id]) => id !== you.id);
  const offices = [
    view.ameerId === you.id && theme.offices.ameer,
    view.nomineeId === you.id && `${theme.offices.wazir} nominee`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <Section title="You">
        <p className="text-2xl font-bold">{theme.roles[you.role]}</p>
        <p>Team: {theme.teams[you.team]}</p>
        {offices.length > 0 && <p>{offices.join(' · ')}</p>}
        {!you.alive && <p className="text-red-400">You have been exiled.</p>}
      </Section>

      {teammates.length > 0 && (
        <Section title="You know">
          <ul>
            {teammates.map(([id, role]) => (
              <li key={id}>
                {name(id)}: {theme.roles[role]}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Phase">
        <p>{theme.phases[view.phase]}</p>
        {view.pendingPower && <p>{theme.powers[view.pendingPower]}</p>}
        {view.myVote && <p>You voted {theme.votes[view.myVote].label}</p>}
        {view.winner && (
          <p className="text-xl font-bold">
            {theme.teams[view.winner.team]} win: {theme.winReasons[view.winner.reason]}
          </p>
        )}
      </Section>

      {view.hand && (
        <Section title="Your hand">
          <p>{view.hand.map((d) => theme.decrees[d]).join(', ')}</p>
        </Section>
      )}

      {view.peek && (
        <Section title={theme.powers.policyPeek}>
          <p>{view.peek.map((d) => theme.decrees[d]).join(', ')}</p>
        </Section>
      )}

      {view.secrets.length > 0 && (
        <Section title="Secrets">
          <ul>
            {view.secrets.map((s, i) => (
              <li key={i}>
                {s.type === 'investigate'
                  ? `${theme.powers.investigate}: ${name(s.targetId)} is ${theme.teams[s.team]}`
                  : `${theme.powers.policyPeek}: ${s.cards.map((d) => theme.decrees[d]).join(', ')}`}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Actions view={view} name={name} act={act} />
    </div>
  );
}

function Actions({
  view,
  name,
  act,
}: {
  view: DiwanPlayerView;
  name: Names;
  act: (action: unknown) => void;
}) {
  const simple = view.legalActions.filter(
    (a): a is Exclude<DiwanAction, TargetAction> => !isTargeted(a),
  );
  const targeted = new Map<TargetType, string[]>();
  for (const a of view.legalActions) {
    if (isTargeted(a)) targeted.set(a.type, [...(targeted.get(a.type) ?? []), a.targetId]);
  }
  if (view.legalActions.length === 0) {
    return <p className="text-center text-slate-400">Nothing to do right now.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {simple.map((a, i) => (
        <ActionButton key={i} onClick={() => act(a)}>
          {actionLabel(a, view)}
        </ActionButton>
      ))}
      {[...targeted].map(([type, ids]) => (
        <Section key={type} title={targetLabel(type)}>
          <div className="flex flex-col gap-2">
            {ids.map((targetId) => (
              <ActionButton key={targetId} onClick={() => act({ type, targetId })}>
                {name(targetId)}
              </ActionButton>
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}

function actionLabel(a: Exclude<DiwanAction, TargetAction>, view: DiwanPlayerView): string {
  const card = (i: number) => {
    const decree = view.hand?.[i];
    return decree ? theme.decrees[decree] : `#${i + 1}`;
  };
  switch (a.type) {
    case 'acknowledge':
      return theme.actions.acknowledge;
    case 'vote':
      return `${theme.votes[a.vote].label} (${theme.votes[a.vote].subtitle})`;
    case 'ameerDiscard':
      return `${theme.actions.ameerDiscard} ${card(a.index)}`;
    case 'wazirEnact':
      return `${theme.actions.wazirEnact} ${card(a.index)}`;
    case 'proposeVeto':
      return theme.actions.proposeVeto;
    case 'answerVeto':
      return a.accept ? theme.actions.acceptVeto : theme.actions.refuseVeto;
    case 'policyPeekDone':
      return theme.actions.policyPeekDone;
  }
}

function targetLabel(type: TargetType): string {
  return type === 'nominate' ? theme.actions.nominate : theme.powers[type];
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
