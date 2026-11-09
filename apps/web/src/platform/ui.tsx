import type { ReactNode } from 'react';

/** Big, thumb-sized buttons for Partybox's own pages. Pressing scales in a touch. */
export function pbButton(tone: 'primary' | 'secondary' | 'quiet' = 'primary'): string {
  const base =
    'inline-flex min-h-14 w-full items-center justify-center rounded-[16px] px-6 text-xl font-bold [font-stretch:105%] transition-[transform,background-color,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-45 disabled:active:scale-100 motion-reduce:transition-none';
  if (tone === 'primary')
    return `${base} bg-pb-punch text-pb-ink shadow-[0_1px_0_rgba(255,255,255,.35)_inset,0_10px_24px_-12px_rgba(255,111,174,.7)] hover:bg-pb-punchDeep`;
  if (tone === 'secondary') return `${base} bg-pb-paper text-pb-ink hover:bg-white`;
  return `${base} border border-pb-line text-pb-paper hover:bg-pb-dusk`;
}

export const pbInput =
  'min-h-14 w-full min-w-0 rounded-[16px] border border-pb-line bg-pb-night px-4 text-pb-paper placeholder:text-pb-lavender/70 focus:border-pb-punch focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-pb-punch';

/** A Partybox page: plum background, paper text, and the pink focus ring. */
export function PbPage({ children }: { children: ReactNode }) {
  return (
    <div className="pb-shell relative min-h-dvh bg-pb-night font-card text-pb-paper">
      {children}
    </div>
  );
}
