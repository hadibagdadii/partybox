import type { LobbyView } from '@partybox/shared';
import { Link, useSearchParams } from 'react-router-dom';
import { DiwanPhone } from '../games/diwan/phone/DiwanPhone';
import { scenarios, type ScenarioId } from '../games/diwan/phone/fixtures';

const room: LobbyView = {
  code: 'DEMO',
  gameId: 'diwan',
  gameName: 'Diwan',
  minPlayers: 5,
  maxPlayers: 10,
  phase: 'playing',
  players: [],
  tutorial: null,
};

/** Dev-only: every Diwan phone screen rendered from fixtures, for design review. */
export function DevDiwan() {
  const [params] = useSearchParams();
  const id = params.get('screen');
  const view = id && id in scenarios ? scenarios[id as ScenarioId] : null;

  if (!view) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 px-safe py-8">
        <h1 className="font-display text-4xl text-court-goldLight">Diwan screens</h1>
        {Object.keys(scenarios).map((key) => (
          <Link
            key={key}
            to={`?screen=${key}`}
            className="rounded-button bg-court-dusk px-4 py-3 text-lg"
          >
            {key}
          </Link>
        ))}
      </main>
    );
  }
  return (
    <DiwanPhone
      key={id}
      room={{ ...room, phase: view.phase === 'over' ? 'over' : 'playing' }}
      you={{ id: 'p1', name: 'Amina', isVip: true }}
      game={view}
      act={async () => undefined}
      seatKey={`partybox:dev-diwan:${id}`}
      reset={view.phase === 'over' ? () => undefined : null}
      playAgain={view.phase === 'over' ? () => undefined : null}
    />
  );
}
