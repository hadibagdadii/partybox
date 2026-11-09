import { colors } from './tokens';

/**
 * The Partybox mark: a box with its lid popped, and confetti escaping. The same drawing is
 * the favicon (public/favicon.svg).
 */
export function Mark({ size = 48, className }: { size?: number; className?: string }) {
  const [pink, yellow, teal, violet] = colors.confetti;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="10" y="30" width="44" height="28" rx="5" fill={colors.paper} />
      <rect x="10" y="30" width="44" height="7" fill={colors.lavender} opacity=".55" />
      <g transform="rotate(-14 12 26)">
        <rect x="6" y="20" width="50" height="9" rx="3.5" fill={pink} />
      </g>
      <circle cx="40" cy="12" r="3.5" fill={yellow} />
      <circle cx="51" cy="20" r="2.6" fill={teal} />
      <rect
        x="27"
        y="5"
        width="5"
        height="5"
        rx="1"
        fill={violet}
        transform="rotate(20 29.5 7.5)"
      />
      <circle cx="53" cy="7" r="2" fill={pink} />
    </svg>
  );
}

/** Mark and name together: the landing page's hero, small elsewhere. */
export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'xl' }) {
  const mark = size === 'xl' ? 88 : size === 'md' ? 44 : 28;
  const text =
    size === 'xl' ? 'text-[44px] sm:text-[88px]' : size === 'md' ? 'text-[32px]' : 'text-[22px]';
  return (
    <span className="inline-flex items-center gap-3 sm:gap-4">
      <Mark
        size={mark}
        className={size === 'xl' ? 'size-14 shrink-0 sm:size-[88px]' : 'shrink-0'}
      />
      <span
        className={`${text} font-card font-black leading-none tracking-[-0.02em] [font-stretch:125%]`}
      >
        partybox
      </span>
    </span>
  );
}
