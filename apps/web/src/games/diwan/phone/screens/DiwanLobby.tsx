import { theme } from '@partybox/diwan';
import { useState } from 'react';
import type { LobbyScreenProps } from '../../../registry';
import { LatticeBackground, Rosette12, Star8 } from '../../ornaments';
import { Button, ConfirmDialog, Frame, Title } from '../ui';

/**
 * Themed waiting room. Once the server says the room can start, the VIP chooses
 * between the tutorial on the TV and starting straight away.
 */
export function DiwanLobby({ room, you, canStart, start, startTutorial, leave }: LobbyScreenProps) {
  const missing = room.minPlayers - room.players.length;
  const { phone, tutorial } = theme;
  const [leaving, setLeaving] = useState(false);
  return (
    <div className="no-select relative flex h-dvh flex-col overflow-hidden bg-court-night pt-safe text-court-parchment">
      <LatticeBackground className="opacity-[0.07]" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <Frame
          actions={
            <>
              {canStart ? (
                <>
                  <p className="text-center text-base text-court-mist">{phone.startChoice}</p>
                  {startTutorial && <Button onClick={startTutorial}>{tutorial.startWith}</Button>}
                  <Button variant={startTutorial ? 'secondary' : 'primary'} onClick={start}>
                    {startTutorial ? tutorial.startNow : phone.start}
                  </Button>
                </>
              ) : (
                <p className="py-3 text-center text-lg text-court-mist">
                  {you.isVip ? phone.waitingForPlayers : phone.waitingForVip}
                </p>
              )}
              <Button
                variant="ghost"
                className="min-h-tap-min text-lg"
                onClick={() => setLeaving(true)}
              >
                {phone.leaveRoom}
              </Button>
            </>
          }
        >
          <div className="flex flex-col items-center gap-1 pt-2">
            <Rosette12 size={88} className="text-court-gold motion-safe:animate-spin-slow" />
            <p className="font-display text-2xl text-court-gold">{theme.gameName}</p>
          </div>
          <Title
            hint={
              <>
                {phone.lobbyCount(room.players.length)}
                {missing > 0 && ` · ${phone.lobbyNeed(missing)}`}
              </>
            }
          >
            {phone.lobbyTitle}
          </Title>
          <p className="text-center text-sm uppercase tracking-[0.3em] text-court-mist">
            {room.code}
          </p>
          <ul className="grid grid-cols-2 gap-2">
            {room.players.map((p) => (
              <li
                key={p.id}
                className={`flex min-h-tap-min items-center gap-2 rounded-card px-3 py-2 ${
                  p.id === you.id ? 'bg-court-indigo' : 'bg-court-dusk'
                }`}
              >
                <Star8 size={16} className="shrink-0 text-court-gold" />
                <span className="min-w-0 flex-1 truncate text-lg">{p.name}</span>
                {p.isVip && (
                  <span className="text-xs uppercase text-court-goldLight">{phone.host}</span>
                )}
              </li>
            ))}
          </ul>
        </Frame>
      </div>
      {leaving && (
        <ConfirmDialog
          message={phone.leaveSure}
          confirmLabel={phone.leaveYes}
          onConfirm={leave}
          onCancel={() => setLeaving(false)}
        />
      )}
    </div>
  );
}
