import { theme } from '@partybox/diwan';
import { useState } from 'react';
import { actionsOf, type ScreenProps } from '../screen';
import { Button, DecreeCard, Frame, Title } from '../ui';

/** Ameer: three decrees, pick one to discard, confirm. */
export function DiscardScreen({ view, act, busy }: ScreenProps) {
  const options = actionsOf(view, 'ameerDiscard');
  const [picked, setPicked] = useState<number | null>(null);
  const choice = options.find((a) => a.index === picked);
  return (
    <Frame
      actions={
        <Button onClick={() => choice && act(choice)} disabled={!choice || busy}>
          {theme.actions.ameerDiscard}
        </Button>
      }
    >
      <Title hint={theme.phone.discardHint}>{theme.phone.discardTitle}</Title>
      <Hand
        view={view}
        indexes={options.map((a) => a.index)}
        picked={picked}
        onPick={setPicked}
        mark={theme.actions.ameerDiscard}
      />
    </Frame>
  );
}

/** Wazir: two decrees, pick one to enact, confirm. Veto only when the server offers it. */
export function EnactScreen({ view, act, busy }: ScreenProps) {
  const options = actionsOf(view, 'wazirEnact');
  const [veto] = actionsOf(view, 'proposeVeto');
  const [picked, setPicked] = useState<number | null>(null);
  const choice = options.find((a) => a.index === picked);
  return (
    <Frame
      actions={
        <>
          {veto && (
            <Button variant="secondary" onClick={() => act(veto)} disabled={busy}>
              {theme.actions.proposeVeto}
            </Button>
          )}
          <Button onClick={() => choice && act(choice)} disabled={!choice || busy}>
            {theme.actions.wazirEnact}
          </Button>
        </>
      }
    >
      <Title hint={theme.phone.enactHint}>{theme.phone.enactTitle}</Title>
      <Hand
        view={view}
        indexes={options.map((a) => a.index)}
        picked={picked}
        onPick={setPicked}
        mark={theme.actions.wazirEnact}
      />
    </Frame>
  );
}

/** Ameer answers the Wazir's veto proposal. */
export function VetoAnswerScreen({ view, name, act, busy }: ScreenProps) {
  const answers = actionsOf(view, 'answerVeto');
  return (
    <Frame
      actions={answers.map((a) => (
        <Button
          key={String(a.accept)}
          variant={a.accept ? 'primary' : 'secondary'}
          onClick={() => act(a)}
          disabled={busy}
        >
          {a.accept ? theme.actions.acceptVeto : theme.actions.refuseVeto}
        </Button>
      ))}
    >
      <Title hint={theme.phone.vetoAnswerHint}>
        {theme.phone.vetoAnswerTitle(name(view.nomineeId))}
      </Title>
    </Frame>
  );
}

function Hand({
  view,
  indexes,
  picked,
  onPick,
  mark,
}: {
  view: ScreenProps['view'];
  indexes: number[];
  picked: number | null;
  onPick: (index: number) => void;
  mark: string;
}) {
  const hand = view.hand ?? [];
  return (
    <div
      className={`my-auto grid w-full gap-3 pb-8 pt-4 ${indexes.length === 3 ? 'grid-cols-3' : 'grid-cols-2 px-4'}`}
    >
      {indexes.map((index) => {
        const decree = hand[index];
        if (!decree) return null;
        return (
          <DecreeCard
            key={index}
            decree={decree}
            selected={picked === index}
            onSelect={() => onPick(index)}
            mark={mark}
            size={indexes.length === 3 ? 'sm' : 'md'}
          />
        );
      })}
    </div>
  );
}
