/**
 * Diwan design tokens: the one place for colors, fonts, radii, spacing, and motion.
 * tailwind.config.ts maps these into utilities (`bg-court-night`, `font-display`, …)
 * so the phone and the TV screen draw from the same palette.
 */
export const colors = {
  night: '#0b1020',
  dusk: '#131a33',
  indigo: '#232c5c',
  indigoLight: '#3a4688',
  emerald: '#0f5c4a',
  emeraldLight: '#1f8a6e',
  gold: '#d4a64a',
  goldLight: '#f0cf7e',
  goldDark: '#8f6a22',
  parchment: '#f3e6c8',
  parchmentDark: '#d9c39a',
  ink: '#1b1410',
  mist: '#a9b0cf',
  danger: '#b8433a',
  /** Loyal Decree: light emerald field, gold trim. */
  loyal: '#cfe8d8',
  loyalInk: '#0f5c4a',
  /** Rebel Decree: dark crimson field, indigo trim. */
  rebel: '#5a1622',
  rebelInk: '#f4d3c4',
  /** Record and badge accents: each event kind gets its own hue. */
  riot: '#f08a3c',
  power: '#8fb3ff',
  exile: '#e0656a',
  seal: '#9b2226',
  sealDark: '#6a1418',
} as const;

export const fonts = {
  display: ['"Aref Ruqaa"', 'Amiri', 'Georgia', 'serif'],
  serif: ['Amiri', 'Georgia', 'serif'],
  sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
} as const;

export const radii = {
  card: '1.25rem',
  button: '1rem',
  sheet: '1.75rem',
} as const;

export const spacing = {
  gutter: '1rem',
  /** Minimum tap target. */
  tap: '3.5rem',
  tapMin: '3rem',
} as const;

export const shadows = {
  glow: '0 0 0 1px rgba(212,166,74,0.35), 0 8px 28px rgba(0,0,0,0.45)',
  lift: '0 10px 30px rgba(0,0,0,0.5)',
  seal: 'inset 0 -4px 8px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.5)',
} as const;

export const motion = {
  fast: '150ms',
  base: '250ms',
  slow: '600ms',
} as const;

/**
 * TV type scale, in px on the 1920×1080 stage. The stage scales as a whole, so
 * these are "px at 1080p"; nothing on the TV goes below `sm`.
 */
export const tvType = {
  sm: '32px',
  md: '40px',
  lg: '56px',
  xl: '80px',
  '2xl': '120px',
} as const;

export const tokens = { colors, fonts, radii, spacing, shadows, motion, tvType } as const;
