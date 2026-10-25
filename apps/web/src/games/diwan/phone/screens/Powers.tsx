import { theme, type DiwanAction, type Secret } from '@partybox/diwan';
import { useState } from 'react';
import { TeamMark } from '../RoleDetails';
import { Scroll, WaxSeal } from '../ornaments';
import { actionsOf, type ScreenProps } from '../screen';
import { Button, ConfirmDialog, DecreeCard, Frame, PlayerCard, Title } from '../ui';

type TargetAction = Extract<DiwanAction, { type: 'investigate' | 'specialElection' | 'execution' }>;

/** Spy, Successor, or Exile: pick a target, confirm; Exile asks once more. */
export function PowerTargetScreen({ view, name, act, busy }: ScreenProps) {
  const options = view.legalActions.filter(
    (a): a is TargetAction =>
      a.type === 'investigate' || a.type === 'specialElection' || a.type === 'execution',
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const power = options[0]?.type;
  const choice = options.find((a) => a.targetId === picked);
  if (!power) return null;

  const confirm = () => {
    if (!choice) return;
    if (choice.type === 'execution') setAsking(true);
    else act(choice);
  };

  return (
    <Frame
      actions={
        <Button
          variant={power === 'execution' ? 'danger' : 'primary'}
          onClick={confirm}
          disabled={!choice || busy}
        >
          {choice ? `${theme.powers[power]}: ${name(choice.targetId)}` : theme.powers[power]}
        </Button>
      }
    >
      <Title hint={theme.phone.powerHints[power]}>
        {theme.phone.powerTitle(theme.powers[power])}
      </Title>
      <div className="flex flex-col gap-3">
        {options.map((a) => (
          <PlayerCard
            key={a.targetId}
            name={name(a.targetId)}
            selected={picked === a.targetId}
            onSelect={() => setPicked(a.targetId)}
          />
        ))}
      </div>
      {asking && choice && (
        <ConfirmDialog
          message={theme.phone.exileSure(name(choice.targetId))}
          confirmLabel={theme.phone.exileYes}
          onConfirm={() => {
            setAsking(false);
            act(choice);
          }}
          onCancel={() => setAsking(false)}
          busy={busy}
        />
      )}
    </Frame>
  );
}

/** Read the Scrolls: the next three decrees, private, with a Done button. */
export function ScrollsScreen({ view, act, busy }: ScreenProps) {
  const [done] = actionsOf(view, 'policyPeekDone');
  return (
    <Frame
      actions={
        done && (
          <Button onClick={() => act(done)} disabled={busy}>
            {theme.actions.policyPeekDone}
          </Button>
        )
      }
    >
      <Title hint={theme.phone.scrollsHint}>{theme.phone.scrollsTitle}</Title>
      <div className="grid grid-cols-3 gap-3 pt-2">
        {(view.peek ?? []).map((decree, i) => (
          <DecreeCard key={i} decree={decree} size="sm" />
        ))}
      </div>
    </Frame>
  );
}

/** Private Spy result. Done only dismisses it on this phone. */
export function SpyResultScreen({
  secret,
  name,
  onDone,
}: {
  secret: Extract<Secret, { type: 'investigate' }>;
  name: ScreenProps['name'];
  onDone: () => void;
}) {
  return (
    <Frame actions={<Button onClick={onDone}>{theme.phone.done}</Button>}>
      <Title>{theme.phone.spyResultTitle}</Title>
      <Scroll>
        <div className="flex flex-col items-center gap-4 text-center">
          <WaxSeal size={72} />
          <p className="text-sm uppercase tracking-[0.2em] opacity-70">
            {theme.powers.investigate}
          </p>
          <p className="flex items-center gap-2 font-display text-3xl">
            <TeamMark team={secret.team} size={30} />
            {theme.teams[secret.team]}
          </p>
          <p className="text-xl">
            {theme.phone.spySecret(name(secret.targetId), theme.teams[secret.team])}
          </p>
        </div>
      </Scroll>
    </Frame>
  );
}
