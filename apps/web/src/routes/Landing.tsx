import { theme } from '@partybox/diwan';
import { ROOM_CODE_LENGTH } from '@partybox/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LatticeBackground, Rosette12, StarRule } from '../games/diwan/ornaments';
import { cleanCode, isFullCode, joinPath } from '../lib/room-code';

const goldButton =
  'flex min-h-16 w-full items-center justify-center rounded-button bg-gradient-to-b from-court-goldLight to-court-gold px-6 text-2xl font-semibold text-court-ink shadow-glow disabled:opacity-50';
const card =
  'flex flex-col gap-4 rounded-card border border-court-gold/30 bg-court-dusk/80 p-5 shadow-lift';

/** First stop for new visitors: what Diwan is, and the two ways in. */
export function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const { landing } = theme;

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (isFullCode(code)) navigate(joinPath(code));
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-court-night text-court-parchment">
      <LatticeBackground className="opacity-[0.07]" />
      <main className="relative mx-auto flex min-h-dvh max-w-4xl flex-col justify-center gap-8 px-safe pb-safe pt-safe md:gap-10 md:py-12">
        <header className="flex flex-col items-center gap-3 text-center">
          <Rosette12 size={72} className="text-court-gold" />
          <h1 className="font-display text-6xl text-court-goldLight md:text-7xl">
            {landing.title}
          </h1>
          <StarRule />
          <p className="max-w-2xl font-serif text-xl leading-snug md:text-2xl">{landing.pitch}</p>
          <p className="text-lg text-court-mist">{landing.players}</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <section className={card} aria-labelledby="landing-host">
            <h2 id="landing-host" className="sr-only">
              {landing.host}
            </h2>
            <Link to="/host" className={goldButton}>
              {landing.host}
            </Link>
            <p className="text-center text-lg text-court-mist">{landing.hostNote}</p>
          </section>

          <section className={card} aria-labelledby="landing-join">
            <h2
              id="landing-join"
              className="text-center font-display text-3xl text-court-goldLight"
            >
              {landing.join}
            </h2>
            <form onSubmit={join} className="flex gap-3">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Room code</span>
                <input
                  value={code}
                  onChange={(e) => setCode(cleanCode(e.target.value))}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={ROOM_CODE_LENGTH}
                  placeholder="CODE"
                  className="min-h-16 w-full min-w-0 rounded-button border border-court-gold/40 bg-court-night px-3 text-center text-3xl font-bold uppercase tracking-[0.3em] text-court-parchment placeholder:text-court-mist/60 focus:border-court-goldLight focus:outline-none focus:ring-2 focus:ring-court-goldLight"
                />
              </label>
              <button
                type="submit"
                disabled={!isFullCode(code)}
                className={`${goldButton} !w-auto`}
              >
                {landing.joinButton}
              </button>
            </form>
          </section>
        </div>

        <section aria-labelledby="landing-how" className="flex flex-col gap-4">
          <h2 id="landing-how" className="text-center font-display text-3xl text-court-goldLight">
            {landing.howItWorks}
          </h2>
          <ol className="grid gap-3 md:grid-cols-3">
            {landing.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3 rounded-card bg-court-dusk/60 p-4">
                <span
                  aria-hidden
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-court-gold/60 font-display text-xl text-court-goldLight"
                >
                  {i + 1}
                </span>
                <span className="text-lg leading-snug">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <Link to="/about" className="mx-auto min-h-12 px-4 py-2 text-lg text-court-mist underline">
          {landing.about}
        </Link>
      </main>
    </div>
  );
}
