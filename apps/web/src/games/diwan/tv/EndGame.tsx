import { theme } from '@partybox/diwan';
import type { LobbyPlayer } from '@partybox/shared';
import { useEffect, useState } from 'react';
import { listNames } from '../format';

/** "End game", then a confirmation. Ending sends everyone to the lobby with roles unrevealed. */
export function EndGameButton({
  endGame,
  className = '',
}: {
  endGame: () => void;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`rounded-button border-2 border-court-danger px-5 py-2 text-court-parchment ${className}`}
      >
        {theme.tv.endGame}
      </button>
    );
  }
  return (
    <div role="alertdialog" aria-label={theme.tv.endGameSure} className="flex flex-col gap-3">
      <p className="text-court-parchment">{theme.tv.endGameSure}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={endGame}
          className="rounded-button bg-court-danger px-5 py-2 font-semibold text-white"
        >
          {theme.tv.endGameYes}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-button border-2 border-court-gold/60 px-5 py-2 text-court-parchment"
        >
          {theme.tv.cancel}
        </button>
      </div>
    </div>
  );
}

/**
 * A gentle prompt once someone has been gone a while: wait for them, or end the game.
 * Waiting hides it for those players until they come back and drop again.
 */
export function AwayPrompt({
  players,
  name,
  endGame,
}: {
  players: LobbyPlayer[];
  name: (id: string) => string;
  endGame?: () => void;
}) {
  const [waiting, setWaiting] = useState<ReadonlySet<string>>(new Set());
  const longAway = players.filter((p) => p.awayLong).map((p) => p.id);
  const key = longAway.join(',');

  // Forget "wait" for anyone who came back, so a second absence prompts again.
  useEffect(() => {
    const away = new Set(key ? key.split(',') : []);
    setWaiting((w) => {
      const kept = [...w].filter((id) => away.has(id));
      return kept.length === w.size ? w : new Set(kept);
    });
  }, [key]);

  const shown = longAway.filter((id) => !waiting.has(id));
  if (shown.length === 0 || !endGame) return null;
  return (
    <div
      role="status"
      data-testid="away-prompt"
      className="absolute left-1/2 top-6 z-40 flex w-[1100px] -translate-x-1/2 flex-col gap-4 rounded-card border-2 border-court-gold/60 bg-court-dusk px-8 py-5 text-tv-sm shadow-lift"
    >
      <p>{theme.tv.awayPrompt(listNames(shown.map(name)))}</p>
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => setWaiting((w) => new Set([...w, ...shown]))}
          className="rounded-button bg-gradient-to-b from-court-goldLight to-court-gold px-6 py-2 font-semibold text-court-ink"
        >
          {theme.tv.awayWait}
        </button>
        <EndGameButton endGame={endGame} />
      </div>
    </div>
  );
}
