import type { Config } from 'tailwindcss';
import { colors, fonts, motion, radii, shadows, spacing } from './src/games/diwan/tokens';

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
      },
      animation: {
        breathe: 'breathe 2.4s ease-in-out infinite',
        'spin-slow': 'spin-slow 24s linear infinite',
        rise: 'rise 250ms ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
