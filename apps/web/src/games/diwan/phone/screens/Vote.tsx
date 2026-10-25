import { theme, type VoteId } from '@partybox/diwan';
import { actionsOf, type ScreenProps } from '../screen';
import { Rosette12 } from '../../ornaments';
import { Frame, Title } from '../ui';

/** Two huge buttons. The vote can change until the reveal; the server decides when that is. */
export function VoteScreen({ view, name, act, busy }: ScreenProps) {
  const options = actionsOf(view, 'vote');
  const mine = view.myVote;
  const styles: Record<VoteId, string> = {
    yes: 'from-court-emeraldLight to-court-emerald',
    no: 'from-court-indigoLight to-court-indigo',
  };
  return (
    <Frame
      actions={
        <>
          <p className="text-center text-base text-court-mist" aria-live="polite">
            {mine ? theme.phone.voteYours(theme.votes[mine].label) : theme.phone.voteNone}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {options.map((a) => {
              const selected = mine === a.vote;
              return (
                <button
                  key={a.vote}
                  type="button"
                  aria-pressed={selected}
                  disabled={busy}
                  onClick={() => act(a)}
                  className={`relative flex min-h-[9rem] flex-col items-center justify-center gap-1 rounded-card border-4 bg-gradient-to-b text-white transition-transform duration-fast motion-safe:active:scale-95 ${styles[a.vote]} ${
                    selected
                      ? 'border-court-goldLight shadow-glow'
                      : 'border-transparent opacity-80'
                  }`}
                >
                  <span className="font-display text-5xl leading-none">
                    {theme.votes[a.vote].label}
                  </span>
                  <span className="text-lg uppercase tracking-widest">
                    {theme.votes[a.vote].subtitle}
                  </span>
                  {selected && (
                    <span className="absolute right-3 top-2 text-2xl text-court-goldLight">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      }
    >
      <Title>{theme.phone.voteTitle(name(view.ameerId), name(view.nomineeId))}</Title>
      <div className="flex justify-center gap-6 text-center">
        <Seat label={theme.offices.ameer} value={name(view.ameerId)} />
        <Seat label={theme.offices.wazir} value={name(view.nomineeId)} />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <Rosette12 size={180} className="text-court-gold/30" />
      </div>
    </Frame>
  );
}

function Seat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm uppercase tracking-widest text-court-mist">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
}
