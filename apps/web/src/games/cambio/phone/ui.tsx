import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Tone = 'primary' | 'call' | 'quiet';

const tones: Record<Tone, string> = {
  // Brass: the one action the turn is waiting on.
  primary:
    'bg-cambio-brass text-cambio-ink shadow-[0_1px_0_rgba(255,255,255,.35)_inset,0_6px_14px_-6px_rgba(0,0,0,.6)]',
  // Calling Cambio ends the round: same weight, its own color.
  call: 'bg-cambio-danger text-white shadow-[0_6px_14px_-6px_rgba(0,0,0,.6)]',
  quiet: 'bg-[rgba(5,24,18,.6)] text-cambio-chalk shadow-[inset_0_0_0_1px_rgba(233,239,233,.22)]',
};

/** A thumb-sized button: 56 px tall when `big`, 48 px otherwise; presses in a touch. */
export function Btn({
  tone = 'quiet',
  big = false,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; big?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`${tones[tone]} ${big ? 'min-h-14 text-xl' : 'min-h-12 text-base'} no-callout select-none rounded-[14px] px-4 focus-visible:outline-cambio-glow font-card font-semibold tracking-[-0.01em] transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-40 motion-reduce:transition-none ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** An eye: "you know this card". */
export function EyeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.4" fill="currentColor" />
    </svg>
  );
}

/** A padlock: the caller's cards are locked. */
export function LockIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="10.5" width="16" height="11" rx="2.5" fill="currentColor" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}
