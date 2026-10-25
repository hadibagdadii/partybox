import type { TapRaceHostView, TapRacePlayerView } from '@partybox/tap-race';
import type { HostScreenProps, PlayerScreenProps } from '../registry';

export function TapRaceHost({ game }: HostScreenProps) {
  const view = game as TapRaceHostView;
  const winner = view.players.find((p) => p.id === view.winnerId);
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {winner ? (
        <>
          <p className="text-4xl text-slate-400">Winner</p>
          <p className="text-9xl font-bold text-amber-400">{winner.name}</p>
        </>
      ) : (
        <>
          <p className="text-8xl font-bold">Tap!</p>
          <p className="text-4xl text-slate-400">First tap on a phone wins.</p>
        </>
      )}
    </div>
  );
}

export function TapRacePlayer({ game, act }: PlayerScreenProps) {
  const view = game as TapRacePlayerView;
  const winner = view.players.find((p) => p.id === view.winnerId);
  if (winner) {
    return (
      <p className="text-center text-4xl font-bold">
        {view.youWon ? 'You won!' : `${winner.name} won`}
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={() => act({ type: 'tap' })}
      className="aspect-square w-full rounded-full bg-amber-500 text-6xl font-bold text-slate-950 active:scale-95"
    >
      TAP
    </button>
  );
}
