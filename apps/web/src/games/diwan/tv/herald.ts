import { theme, type DiwanHostView, type LogEntry } from '@partybox/diwan';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { heraldPrefs } from '../../../lib/storage';
import { voteTally } from '../court-record';
import { nameLookup, type Names } from '../format';

/**
 * The court herald. It speaks only lines built from public log entries (plus the
 * fixed night line), so it can never say more than the court record shows.
 */

/** The spoken line for one public log entry, or null if the herald stays quiet. */
export function heraldLine(entry: LogEntry, name: Names): string | null {
  const { herald, decrees, powers, teams, winReasons } = theme;
  const say = (n: number) => herald.numbers[n] ?? String(n);
  switch (entry.type) {
    case 'nominated':
      return herald.nominated(name(entry.ameerId), name(entry.wazirId));
    case 'votesRevealed': {
      const { yes, no } = voteTally(entry.votes);
      return herald.vote(entry.passed, say(yes), say(no));
    }
    case 'riot':
      return herald.riot(decrees[entry.decree]);
    case 'enacted':
      return herald.enacted(decrees[entry.decree]);
    case 'powerUsed':
      return herald.powerUsed(
        name(entry.ameerId),
        powers[entry.power],
        entry.targetId ? name(entry.targetId) : null,
      );
    case 'exiled':
      return herald.exiled(name(entry.targetId));
    case 'gameOver':
      return herald.gameOver(teams[entry.winner], winReasons[entry.reason]);
    case 'unrest':
    case 'reshuffled':
    case 'vetoProposed':
    case 'vetoAnswered':
      return null;
  }
}

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

interface HeraldState {
  /** Speech needs a user gesture after every page load, so this is never persisted. */
  enabled: boolean;
  muted: boolean;
  voiceURI: string | null;
}

let speaker: Speaker | null | undefined;
let state: HeraldState = { enabled: false, ...heraldPrefs.get() };
const listeners = new Set<() => void>();
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
  /** Call from a tap: unlocks speech for this page and says the herald is ready. */
  enable() {
    update({ enabled: true });
    herald.say(theme.tv.heraldReady);
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

/**
 * Narrates new public log entries and the night phase, and returns the caption
 * to show. Captions always show, even when the herald is muted or not enabled.
 */
export function useHerald(view: DiwanHostView): string | null {
  const name = useMemo(() => nameLookup(view.players), [view.players]);
  const [caption, setCaption] = useState<string | null>(null);
  const seen = useRef<number | null>(null);
  const lastPhase = useRef<DiwanHostView['phase'] | null>(null);

  useEffect(() => {
    if (view.phase === 'reveal' && lastPhase.current !== 'reveal') {
      setCaption(theme.herald.night);
      herald.say(theme.herald.night);
    }
    lastPhase.current = view.phase;
  }, [view.phase]);

  useEffect(() => {
    const log = view.log;
    if (seen.current === null || log.length < seen.current) {
      seen.current = log.length;
      return;
    }
    const fresh = log.slice(seen.current);
    seen.current = log.length;
    for (const entry of fresh) {
      const line = heraldLine(entry, name);
      if (!line) continue;
      setCaption(line);
      herald.say(line);
    }
  }, [view.log, name]);

  return caption;
}
