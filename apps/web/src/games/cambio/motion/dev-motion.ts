import type { MotionOptions } from './useCambioMotion';

/**
 * Dev only: `?slowmo=4` plays the table four times slower on /play and /host, for checking motion
 * by eye. Empty in production builds.
 */
export function devMotion(search = typeof location === 'undefined' ? '' : location.search) {
  if (!import.meta.env.DEV) return {} satisfies MotionOptions;
  const n = Number(new URLSearchParams(search).get('slowmo'));
  return Number.isFinite(n) && n >= 1 && n <= 10 ? { timeScale: n } : {};
}
