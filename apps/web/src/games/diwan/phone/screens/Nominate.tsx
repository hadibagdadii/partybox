import { theme } from '@partybox/diwan';
import { useState } from 'react';
import { actionsOf, type ScreenProps } from '../screen';
import { Button, Frame, PlayerCard, Title } from '../ui';

/** Ameer picks a Wazir from the server's eligible list, then confirms. */
export function NominateScreen({ view, name, act, busy }: ScreenProps) {
  const options = actionsOf(view, 'nominate');
  const [picked, setPicked] = useState<string | null>(null);
  const choice = options.find((a) => a.targetId === picked);
  return (
    <Frame
      actions={
        <Button onClick={() => choice && act(choice)} disabled={!choice || busy}>
          {choice ? `${theme.actions.nominate}: ${name(choice.targetId)}` : theme.actions.nominate}
        </Button>
      }
    >
      <Title hint={theme.phone.nominateHint}>{theme.phone.nominateTitle}</Title>
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
    </Frame>
  );
}
