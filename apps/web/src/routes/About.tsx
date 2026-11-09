import { theme as cambio } from '@partybox/cambio';
import { theme as diwan } from '@partybox/diwan';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Wordmark } from '../platform/Mark';
import { partybox } from '../platform/theme';
import { gameAccents } from '../platform/tokens';
import { pbButton, PbPage } from '../platform/ui';

function GameSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={`about-${id}`}
      data-game={id}
      className="flex flex-col gap-3 rounded-[20px] border border-pb-line p-5"
    >
      <h2
        id={`about-${id}`}
        className="flex items-center gap-2.5 text-[26px] font-extrabold leading-none [font-stretch:115%]"
      >
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-full"
          style={{ background: gameAccents[id] }}
        />
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Partybox, then each game: Diwan's attribution and license, and Cambio's origin. Free. */
export function About() {
  const navigate = useNavigate();
  const location = useLocation();
  const { about } = partybox;
  // A direct visit or new tab has no in-app history to go back to.
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/'));
  return (
    <PbPage>
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-safe pb-safe pt-safe md:py-12">
        <header className="flex flex-col gap-4">
          <Wordmark size="md" />
          <h1 className="text-4xl font-extrabold [font-stretch:115%]">{about.title}</h1>
          <p className="text-xl leading-snug [text-wrap:pretty]">{about.intro}</p>
        </header>

        <GameSection id="diwan" title={diwan.gameName}>
          <p className="text-lg leading-snug [text-wrap:pretty]">{diwan.about.attribution}</p>
          <p className="text-base text-pb-lavender">{diwan.about.free}</p>
          <a
            href={diwan.about.licenseUrl}
            target="_blank"
            rel="noreferrer license"
            className="min-h-11 self-start py-2 text-lg text-pb-punch underline underline-offset-4"
          >
            {diwan.about.licenseLink}
          </a>
          <p className="text-base text-pb-lavender">
            {diwan.about.licenseFileLabel}{' '}
            <code className="break-all rounded bg-pb-dusk px-2 py-0.5 text-pb-paper">
              {diwan.about.licenseFile}
            </code>
          </p>
        </GameSection>

        <GameSection id="cambio" title={cambio.about.title}>
          <p className="text-lg leading-snug [text-wrap:pretty]">{cambio.about.body}</p>
        </GameSection>

        <button type="button" onClick={back} className={pbButton('quiet')}>
          {about.back}
        </button>
      </main>
    </PbPage>
  );
}
