import { theme, type DiwanAction, type DiwanPlayerView } from '@partybox/diwan';
import { useMemo, useState } from 'react';
import { useTurnBuzz } from '../../../lib/vibrate';
import type { PlayerScreenProps } from '../../registry';
import { nameLookup, type Names } from '../format';
import { useHold } from './HoldToReveal';
import { useSeenSecrets } from './useSeenSecrets';
import { LatticeBackground, WaxSeal } from './ornaments';
import { LogList, RoleDetails } from './RoleDetails';
import { pickScreen, type ScreenProps } from './screen';
import { NominateScreen } from './screens/Nominate';
import { DiscardScreen, EnactScreen, VetoAnswerScreen } from './screens/Legislate';
import { PowerTargetScreen, ScrollsScreen, SpyResultScreen } from './screens/Powers';
import { RevealScreen } from './screens/Reveal';
import { ExiledScreen, GameOverScreen, WaitingScreen } from './screens/Status';
import { VoteScreen } from './screens/Vote';
import { BottomSheet } from './ui';

/** The Diwan phone: header with role peek and log, then the screen the server's view calls for. */
export function DiwanPhone({ room, you: seat, game, act, seatKey, reset }: PlayerScreenProps) {
  const view = game as DiwanPlayerView;
  const name = useMemo(() => nameLookup(view.players), [view.players]);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const { unseenSpy, markSeen } = useSeenSecrets(seatKey, view.secrets);
  useTurnBuzz(!!view.you && view.waitingOn.includes(view.you.id));

  const send = (action: DiwanAction) => {
    setBusy(true);
    void act(action).finally(() => setBusy(false));
  };

  const screen = pickScreen(view, unseenSpy !== null);
  const props: ScreenProps = { view, name, act: send, busy };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-court-night text-court-parchment">
      <LatticeBackground className="opacity-[0.07]" />
      <header className="relative z-30 flex items-center justify-between gap-2 border-b border-court-gold/20 bg-court-night/80 px-safe pb-2 pt-safe backdrop-blur">
        {view.you ? <RolePeek view={view} name={name} /> : <span />}
        <p className="min-w-0 truncate text-center text-sm text-court-mist">
          <span className="font-semibold tracking-widest text-court-gold">{room.code}</span>
          <span className="block truncate">{seat.name}</span>
        </p>
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="min-h-tap-min rounded-button border border-court-gold/40 px-3 text-base text-court-parchment active:bg-court-indigo"
        >
          {theme.phone.courtRecord}
        </button>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {!view.you ? null : screen === 'spyResult' && unseenSpy ? (
          <SpyResultScreen secret={unseenSpy} name={name} onDone={markSeen} />
        ) : screen === 'gameOver' ? (
          <GameOverScreen view={view} name={name} reset={reset} />
        ) : (
          <Screen key={screen} id={screen} {...props} />
        )}
      </div>

      <BottomSheet title={theme.phone.courtRecord} open={logOpen} onClose={() => setLogOpen(false)}>
        <LogList view={view} name={name} />
      </BottomSheet>
    </div>
  );
}

function Screen({ id, ...props }: ScreenProps & { id: ReturnType<typeof pickScreen> }) {
  switch (id) {
    case 'reveal':
      return <RevealScreen {...props} />;
    case 'nominate':
      return <NominateScreen {...props} />;
    case 'vote':
      return <VoteScreen {...props} />;
    case 'discard':
      return <DiscardScreen {...props} />;
    case 'enact':
      return <EnactScreen {...props} />;
    case 'vetoAnswer':
      return <VetoAnswerScreen {...props} />;
    case 'powerTarget':
      return <PowerTargetScreen {...props} />;
    case 'scrolls':
      return <ScrollsScreen {...props} />;
    case 'exiled':
      return <ExiledScreen {...props} />;
    case 'waiting':
    case 'spyResult':
    case 'gameOver':
      return <WaitingScreen {...props} />;
  }
}

/** Small header button: hold to see your role, teammates, and secrets. */
function RolePeek({ view, name }: { view: DiwanPlayerView; name: Names }) {
  const { held, bind } = useHold();
  return (
    <>
      <button
        type="button"
        aria-pressed={held}
        className="no-callout flex min-h-tap-min items-center gap-2 rounded-button border border-court-gold/40 pl-1 pr-3 text-base active:bg-court-indigo"
        {...bind}
      >
        <WaxSeal size={34} />
        {theme.phone.myRole}
      </button>
      {held && (
        <div
          data-testid="role-peek"
          className="pointer-events-none fixed inset-x-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+4rem)] z-40 rounded-card border border-court-gold/50 bg-court-dusk p-5 shadow-lift"
        >
          <RoleDetails view={view} name={name} />
        </div>
      )}
    </>
  );
}
