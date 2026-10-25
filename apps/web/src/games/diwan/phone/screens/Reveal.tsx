import { theme } from '@partybox/diwan';
import { HoldToReveal } from '../HoldToReveal';
import { Rosette12, Scroll, WaxSeal } from '../../ornaments';
import { RoleDetails } from '../RoleDetails';
import { actionsOf, type ScreenProps } from '../screen';
import { Button, Frame, Title } from '../ui';

/** The sealed scroll: hold to read your role, release to hide it again. */
export function RevealScreen({ view, name, act, busy }: ScreenProps) {
  const [ack] = actionsOf(view, 'acknowledge');
  return (
    <Frame
      actions={
        ack && (
          <Button onClick={() => act(ack)} disabled={busy}>
            {theme.phone.acknowledge}
          </Button>
        )
      }
    >
      <Title>{theme.phases.reveal}</Title>
      <HoldToReveal
        label={theme.phone.holdToReveal}
        className="flex-1"
        cover={
          <Scroll className="pointer-events-none">
            <span className="relative flex min-h-[18rem] flex-col items-center justify-center gap-5">
              <Rosette12 size={220} className="absolute text-court-goldDark/25" />
              <WaxSeal size={112} className="relative drop-shadow-xl" />
              <span className="relative text-lg font-semibold">{theme.phone.holdToReveal}</span>
            </span>
          </Scroll>
        }
      >
        <Scroll className="pointer-events-none">
          <div className="min-h-[18rem]">
            <RoleDetails view={view} name={name} />
            <p className="mt-4 text-center text-sm opacity-70">{theme.phone.releaseToHide}</p>
          </div>
        </Scroll>
      </HoldToReveal>
    </Frame>
  );
}
