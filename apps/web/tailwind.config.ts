import type { Config } from 'tailwindcss';
import { colors, fonts, motion, radii, shadows, spacing, tvType } from './src/games/diwan/tokens';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { court: colors },
      fontFamily: {
        display: [...fonts.display],
        serif: [...fonts.serif],
        sans: [...fonts.sans],
      },
      fontSize: Object.fromEntries(
        Object.entries(tvType).map(([k, v]) => [`tv-${k}`, [v, { lineHeight: '1.2' }]]),
      ) as Record<string, [string, { lineHeight: string }]>,
      borderRadius: radii,
      spacing,
      minHeight: { tap: spacing.tap, 'tap-min': spacing.tapMin },
      minWidth: { tap: spacing.tap, 'tap-min': spacing.tapMin },
      boxShadow: shadows,
      transitionDuration: motion,
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.06)', opacity: '1' },
        },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        // Transform only: content stays readable even if the animation clock is paused.
        rise: {
          from: { transform: 'translateY(12px)' },
          to: { transform: 'translateY(0)' },
        },
        // TV moments. Every keyframe starts from a visible pose, so a stalled clock
        // never hides anything (see Phase 4).
        'slot-in': {
          from: { transform: 'translateY(-260px) scale(1.35) rotate(-6deg)' },
          to: { transform: 'none' },
        },
        pop: {
          from: { transform: 'scale(1.25)' },
          to: { transform: 'scale(1)' },
        },
        'drop-in': {
          from: { transform: 'translateY(-48px)' },
          to: { transform: 'none' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-14px)' },
          '40%, 80%': { transform: 'translateX(14px)' },
        },
        'pulse-ring': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.08)' },
        },
      },
      animation: {
        breathe: 'breathe 2.4s ease-in-out infinite',
        'spin-slow': 'spin-slow 24s linear infinite',
        rise: 'rise 250ms ease-out both',
        'slot-in': 'slot-in 900ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        pop: 'pop 450ms ease-out',
        'drop-in': 'drop-in 500ms ease-out',
        shake: 'shake 600ms ease-in-out 2',
        'pulse-ring': 'pulse-ring 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
