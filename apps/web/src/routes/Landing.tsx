import { ROOM_CODE_LENGTH } from '@partybox/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEnabledGames } from '../lib/config';
import { cleanCode, isFullCode, joinPath } from '../lib/room-code';
import { Wordmark } from '../platform/Mark';
import { games, partybox } from '../platform/theme';
import { gameAccents } from '../platform/tokens';
import { pbButton, pbInput, PbPage } from '../platform/ui';

/** Before the server answers, list only what every deployment offers. */
const ALWAYS = new Set(['diwan']);

/** First stop for new visitors: what Partybox is, the games, and the two ways in. */
export function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const enabled = useEnabledGames();
  const { landing } = partybox;
  const listed = games.filter((g) => (enabled ? enabled.includes(g.id) : ALWAYS.has(g.id)));

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (isFullCode(code)) navigate(joinPath(code));
  };

  return (
    <PbPage>
      <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-12 px-safe pb-safe pt-safe md:gap-16 md:px-10 md:py-16">
        <div className="grid gap-10 pt-6 md:grid-cols-[1.1fr_1fr] md:items-end md:gap-14">
          <header className="flex flex-col gap-5">
            <h1 aria-label={partybox.name} className="text-pb-paper">
              <Wordmark size="xl" />
            </h1>
            <p className="max-w-[28ch] text-2xl font-medium leading-snug text-pb-paper [text-wrap:balance] md:text-[28px]">
              {landing.pitch}
            </p>
          </header>

          <div className="flex flex-col gap-6 rounded-[28px] bg-pb-dusk p-5 md:p-7">
            <section aria-labelledby="landing-host" className="flex flex-col gap-2">
              <h2 id="landing-host" className="sr-only">
                {landing.host}
              </h2>
              <Link to="/host" className={pbButton('primary')}>
                {landing.host}
              </Link>
              <p className="text-base text-pb-lavender">{landing.hostNote}</p>
            </section>
            <section aria-labelledby="landing-join" className="flex flex-col gap-3">
              <h2 id="landing-join" className="text-xl font-bold [font-stretch:110%]">
                {landing.join}
              </h2>
              <form onSubmit={join} className="flex gap-3">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">{landing.codeLabel}</span>
                  <input
                    value={code}
                    onChange={(e) => setCode(cleanCode(e.target.value))}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={ROOM_CODE_LENGTH}
                    placeholder={landing.codePlaceholder}
                    className={`${pbInput} text-center text-[26px] font-extrabold uppercase tracking-[0.18em]`}
                  />
                </label>
                <button
                  type="submit"
                  disabled={!isFullCode(code)}
                  className={`${pbButton('secondary')} !w-auto px-6`}
                >
                  {landing.joinButton}
                </button>
              </form>
            </section>
          </div>
        </div>

        <section aria-labelledby="landing-games" className="flex flex-col gap-4">
          <h2 id="landing-games" className="text-2xl font-bold [font-stretch:110%]">
            {landing.games}
          </h2>
          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 md:gap-4">
            {listed.map((g) => (
              <li
                key={g.id}
                data-game={g.id}
                className="flex flex-col gap-2 rounded-[20px] border border-pb-line p-5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="flex items-center gap-2.5 text-[28px] font-extrabold leading-none [font-stretch:115%]">
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 rounded-full"
                      style={{ background: gameAccents[g.id] }}
                    />
                    {g.name}
                  </h3>
                  <p className="shrink-0 text-base tabular-nums text-pb-lavender">{g.players}</p>
                </div>
                <p className="text-lg leading-snug [text-wrap:pretty]">{g.pitch}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="landing-how" className="flex flex-col gap-4">
          <h2 id="landing-how" className="text-2xl font-bold [font-stretch:110%]">
            {landing.howItWorks}
          </h2>
          <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
            {landing.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 flex-none items-center justify-center rounded-full bg-pb-dusk text-lg font-extrabold tabular-nums text-pb-punch"
                >
                  {i + 1}
                </span>
                <span className="pt-1 text-lg leading-snug [text-wrap:pretty]">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <Link
          to="/about"
          className="min-h-12 self-start py-3 text-lg text-pb-lavender underline underline-offset-4 hover:text-pb-paper"
        >
          {landing.about}
        </Link>
      </main>
    </PbPage>
  );
}
