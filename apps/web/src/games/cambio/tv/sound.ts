import { useEffect, useRef, useSyncExternalStore } from 'react';
import { herald } from '../../../lib/herald';
import { cambioPrefs } from '../../../lib/storage';
import type { Step } from '../motion/steps';
import type { MotionFrame } from '../motion/useCambioMotion';
import { timing } from '../tokens';

/**
 * Card sounds for the TV, synthesized with Web Audio: no audio files. They start from the same
 * tap that enables the herald, and have their own mute.
 */
export type CardSound = 'deal' | 'flip' | 'slide' | 'snap' | 'wrong';

/** Plays a sound `delay` seconds from now. Behind an interface so tests can listen in. */
export interface Synth {
  play(sound: CardSound, delay: number): void;
  /** Called inside a tap: browsers only start audio from a user gesture. */
  resume(): void;
}

function browserSynth(): Synth | null {
  const Ctx =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);

  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
  const data = noise.getChannelData(0);
  // A fixed pattern, not Math.random: the same hiss every time.
  let seed = 22_222;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16_807) % 2_147_483_647;
    data[i] = (seed / 2_147_483_647) * 2 - 1;
  }

  /** A burst of noise through a filter, with a quick attack and an exponential fade. */
  const hiss = (
    t: number,
    length: number,
    filter: BiquadFilterType,
    freq: number,
    peak: number,
    sweepTo?: number,
  ) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.012, length / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + length + 0.02);
  };

  /** A pitched tone gliding from `from` to `to` Hz. */
  const tone = (
    t: number,
    length: number,
    type: OscillatorType,
    from: number,
    to: number,
    peak: number,
  ) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + length);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    o.connect(f).connect(g).connect(master);
    o.start(t);
    o.stop(t + length + 0.02);
  };

  return {
    resume() {
      void ctx.resume();
    },
    play(sound, delay) {
      if (ctx.state !== 'running') return;
      const t = ctx.currentTime + Math.max(0, delay);
      switch (sound) {
        case 'deal':
          hiss(t, 0.045, 'bandpass', 3200, 0.22);
          break;
        case 'flip':
          hiss(t, 0.03, 'highpass', 2400, 0.16);
          hiss(t + 0.05, 0.035, 'highpass', 1800, 0.12);
          break;
        case 'slide':
          hiss(t, 0.22, 'lowpass', 700, 0.14, 2600);
          break;
        case 'snap':
          tone(t, 0.14, 'sine', 140, 55, 0.55);
          hiss(t, 0.035, 'highpass', 1600, 0.38);
          break;
        case 'wrong':
          tone(t, 0.12, 'square', 330, 320, 0.09);
          tone(t + 0.13, 0.24, 'square', 220, 200, 0.09);
          break;
      }
    },
  };
}

interface SoundState {
  muted: boolean;
}

let synth: Synth | null | undefined;
let unlocked = false;
let state: SoundState = { muted: cambioPrefs.soundMuted() };
const listeners = new Set<() => void>();

const getSynth = () => {
  if (synth === undefined) synth = browserSynth();
  return synth;
};

export const cardSounds = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setMuted(muted: boolean) {
    cambioPrefs.setSoundMuted(muted);
    state = { muted };
    listeners.forEach((l) => l());
  },
  /** Starts audio; must run inside a tap. The herald's enable tap calls it. */
  unlock() {
    unlocked = true;
    getSynth()?.resume();
  },
  /** Plays if narration was enabled by a tap and card sounds aren't muted. */
  play(sound: CardSound, delayMs = 0) {
    if (!unlocked || !herald.get().enabled || state.muted) return;
    getSynth()?.play(sound, delayMs / 1000);
  },
  /** Tests only: swap the synth and start over as on a fresh page load. */
  reset(replacement?: Synth | null) {
    synth = replacement;
    unlocked = false;
    state = { muted: cambioPrefs.soundMuted() };
    listeners.forEach((l) => l());
  },
};

// One tap turns on both narration and card sounds.
herald.onEnable(() => cardSounds.unlock());

export function useCardSoundState(): SoundState {
  return useSyncExternalStore(cardSounds.subscribe, cardSounds.get, cardSounds.get);
}

/** At most this many deal ticks per deal, spread across it; a 12-seat deal has 49 cards. */
const MAX_DEAL_TICKS = 16;

/** The sounds a step makes, in ms from its start (before the playback rate). */
export function cuesFor(step: Step): { sound: CardSound; at: number }[] {
  const flips = step.flips.map((f) => ({ sound: 'flip' as const, at: f.delay }));
  switch (step.kind) {
    case 'deal': {
      const every = Math.max(1, Math.ceil(step.moves.length / MAX_DEAL_TICKS));
      return step.moves
        .filter((_, i) => i % every === 0)
        .map((m) => ({ sound: 'deal' as const, at: m.delay }));
    }
    case 'draw':
    case 'blindSwap':
      return [{ sound: 'slide', at: 0 }];
    case 'swap':
    case 'discard':
      return [{ sound: 'slide', at: 0 }, ...flips];
    case 'snap':
      return [{ sound: 'snap', at: timing.snapFlight }];
    case 'snapGive':
      return [
        { sound: 'snap', at: timing.snapFlight },
        { sound: 'slide', at: timing.snapFlight - 80 },
      ];
    case 'wrongSnap': {
      const shake = step.effects.find((e) => e.kind === 'shake');
      const penalty = step.moves[0];
      return [
        { sound: 'flip', at: 0 },
        { sound: 'wrong', at: shake?.delay ?? timing.flip },
        ...(penalty ? [{ sound: 'deal' as const, at: penalty.delay }] : []),
      ];
    }
    case 'reshuffle':
      return [
        { sound: 'slide', at: 0 },
        { sound: 'slide', at: timing.sweep * 0.5 },
      ];
    case 'reveal':
      return flips;
    case 'peek':
    case 'call':
    case 'quiet':
      return [];
  }
}

/** Plays each step's sounds as it starts on screen, in time with its motion. */
export function useCardSounds(frame: MotionFrame): void {
  const played = useRef<number | null>(null);
  const flashed = useRef<number | null>(null);
  const { playing, highlight, timeScale } = frame;
  useEffect(() => {
    if (!playing || played.current === playing.id) return;
    played.current = playing.id;
    const k = playing.rate * timeScale;
    for (const cue of cuesFor(playing.step)) cardSounds.play(cue.sound, cue.at * k);
  }, [playing, timeScale]);
  // Reduced motion: no steps play, so one soft cue marks each change.
  useEffect(() => {
    if (!highlight || flashed.current === highlight.key) return;
    flashed.current = highlight.key;
    cardSounds.play('flip');
  }, [highlight]);
}
