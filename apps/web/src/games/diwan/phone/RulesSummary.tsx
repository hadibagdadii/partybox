import { theme } from '@partybox/diwan';

/** The seven tutorial topics as a short read, for checking the rules mid-game. */
export function RulesSummary() {
  return (
    <ol className="flex flex-col gap-4" aria-label={theme.rules.title}>
      {theme.tutorial.slides.map((slide, i) => (
        <li key={slide.title} className="rounded-card bg-court-night/60 px-4 py-3">
          <h3 className="font-display text-2xl text-court-goldLight">
            <span className="mr-2 text-court-gold">{i + 1}.</span>
            {slide.title}
          </h3>
          <p className="mt-1 text-lg leading-snug">{slide.body}</p>
        </li>
      ))}
    </ol>
  );
}
