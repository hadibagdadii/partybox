import { theme } from '@partybox/diwan';
import { useLocation, useNavigate } from 'react-router-dom';
import { LatticeBackground, StarRule } from '../games/diwan/ornaments';

/** Attribution and license. Diwan is free: no ads, no paid features. */
export function About() {
  const navigate = useNavigate();
  const location = useLocation();
  const { about } = theme;
  // A direct visit or new tab has no in-app history to go back to.
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/'));
  return (
    <div className="relative min-h-dvh overflow-hidden bg-court-night text-court-parchment">
      <LatticeBackground className="opacity-[0.07]" />
      <main className="relative mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-safe pb-safe pt-safe">
        <header className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-display text-5xl text-court-goldLight">{about.title}</h1>
          <StarRule />
        </header>
        <p className="font-serif text-2xl leading-snug">{about.attribution}</p>
        <p className="text-lg text-court-mist">{about.free}</p>
        <a
          href={about.licenseUrl}
          target="_blank"
          rel="noreferrer license"
          className="text-xl text-court-goldLight underline"
        >
          {about.licenseLink}
        </a>
        <p className="text-lg text-court-mist">
          {about.licenseFileLabel}{' '}
          <code className="break-all rounded bg-court-dusk px-2 py-0.5 text-court-parchment">
            {about.licenseFile}
          </code>
        </p>
        <button
          type="button"
          onClick={back}
          className="min-h-tap w-full rounded-button border border-court-gold/60 bg-court-dusk/80 px-5 text-xl font-semibold"
        >
          {about.back}
        </button>
      </main>
    </div>
  );
}
