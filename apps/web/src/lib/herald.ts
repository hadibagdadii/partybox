import { useEffect, useState, useSyncExternalStore } from 'react';
import { heraldPrefs } from './storage';

/**
 * The TV's narrator, shared by every game: text to speech behind a tap to enable, a mute, a
 * voice choice, and a short queue so it keeps up. Each game decides what lines to say, built
 * only from public information.
 */

export interface Voice {
  uri: string;
  name: string;
  lang: string;
}

/** Text to speech, behind an interface so tests can listen in. */
export interface Speaker {
  speak(text: string, voiceURI: string | null, onEnd: () => void): void;
  cancel(): void;
  voices(): Voice[];
  onVoicesChanged(cb: () => void): () => void;
}

function browserSpeaker(): Speaker | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const synth = window.speechSynthesis;
  return {
    speak(text, voiceURI, onEnd) {
      const u = new SpeechSynthesisUtterance(text);
      const voice = voiceURI ? synth.getVoices().find((v) => v.voiceURI === voiceURI) : undefined;
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.onend = onEnd;
      u.onerror = onEnd;
      synth.speak(u);
    },
    cancel: () => synth.cancel(),
    voices: () => synth.getVoices().map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang })),
    onVoicesChanged(cb) {
      synth.addEventListener('voiceschanged', cb);
      return () => synth.removeEventListener('voiceschanged', cb);
    },
  };
}

/** At most this many lines wait to be spoken; older ones are dropped so the herald keeps up. */
export const MAX_PENDING = 2;

export interface HeraldState {
  /** Speech needs a user gesture after every page load, so this is never persisted. */
  enabled: boolean;
  muted: boolean;
  voiceURI: string | null;
}

let speaker: Speaker | null | undefined;
let state: HeraldState = { enabled: false, ...heraldPrefs.get() };
const listeners = new Set<() => void>();
const enableListeners = new Set<() => void>();
let pending: string[] = [];
let speaking = false;
let watchdog: ReturnType<typeof setTimeout> | undefined;

function getSpeaker(): Speaker | null {
  if (speaker === undefined) speaker = browserSpeaker();
  return speaker;
}

function update(next: Partial<HeraldState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function next() {
  const s = getSpeaker();
  const line = pending.shift();
  if (!s || line === undefined) {
    speaking = false;
    return;
  }
  speaking = true;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(watchdog);
    next();
  };
  // Some browsers never fire onend; don't let one lost event silence the herald.
  watchdog = setTimeout(finish, 2000 + line.length * 120);
  s.speak(line, state.voiceURI, finish);
}

export const herald = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /**
   * Call from a tap: unlocks speech for this page and says `readyLine`. Other things that need
   * a tap to start (Cambio's card sounds) listen with `onEnable`.
   */
  enable(readyLine?: string) {
    update({ enabled: true });
    enableListeners.forEach((l) => l());
    if (readyLine) herald.say(readyLine);
  },
  /** Runs `cb` inside every enable tap. */
  onEnable(cb: () => void) {
    enableListeners.add(cb);
    return () => enableListeners.delete(cb);
  },
  setMuted(muted: boolean) {
    heraldPrefs.setMuted(muted);
    update({ muted });
    if (muted) {
      pending = [];
      getSpeaker()?.cancel();
    }
  },
  setVoice(voiceURI: string | null) {
    heraldPrefs.setVoice(voiceURI);
    update({ voiceURI });
  },
  /** Queues a line if the herald may speak; drops the oldest beyond MAX_PENDING. */
  say(line: string) {
    if (!state.enabled || state.muted || !getSpeaker()) return;
    pending.push(line);
    if (pending.length > MAX_PENDING) pending = pending.slice(-MAX_PENDING);
    if (!speaking) next();
  },
  voices: (): Voice[] => getSpeaker()?.voices() ?? [],
  onVoicesChanged: (cb: () => void) => getSpeaker()?.onVoicesChanged(cb) ?? (() => undefined),
  /** Tests only: swap the speaker and reset to a fresh page load. */
  reset(replacement?: Speaker | null) {
    clearTimeout(watchdog);
    speaker = replacement;
    pending = [];
    speaking = false;
    state = { enabled: false, ...heraldPrefs.get() };
    listeners.forEach((l) => l());
  },
};

export function useHeraldState(): HeraldState {
  return useSyncExternalStore(herald.subscribe, herald.get, herald.get);
}

/** The browser's voices, updated when they load. */
export function useVoices(): Voice[] {
  const [voices, setVoices] = useState(herald.voices);
  useEffect(() => herald.onVoicesChanged(() => setVoices(herald.voices())), []);
  return voices;
}
