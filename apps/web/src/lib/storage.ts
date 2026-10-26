/** localStorage can throw (private mode, blocked storage); treat that as empty. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Reconnect just won't survive a refresh.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to clean up.
  }
}

/** `?slot=N` namespaces tokens so same-origin iframes on /dev get separate seats. */
export function parseSlot(raw: string | null): string | null {
  return raw && /^\d{1,2}$/.test(raw) ? raw : null;
}

export function playerTokenKey(code: string, slot: string | null): string {
  return slot ? `partybox:${code}:slot${slot}` : `partybox:${code}`;
}

export const playerToken = {
  get: (code: string, slot: string | null) => read(playerTokenKey(code, slot)),
  set: (code: string, slot: string | null, token: string) =>
    write(playerTokenKey(code, slot), token),
  clear: (code: string, slot: string | null) => remove(playerTokenKey(code, slot)),
};

/** The name this device last joined with, prefilled next time. */
export const lastName = {
  get: () => read('partybox:lastName') ?? '',
  set: (name: string) => write('partybox:lastName', name),
};

export interface HostSession {
  code: string;
  hostToken: string;
}

const HOST_KEY = 'partybox:host';

export const hostSession = {
  get(): HostSession | null {
    const raw = read(HOST_KEY);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as Partial<HostSession>;
      return typeof value.code === 'string' && typeof value.hostToken === 'string'
        ? { code: value.code, hostToken: value.hostToken }
        : null;
    } catch {
      return null;
    }
  },
  set: (session: HostSession) => write(HOST_KEY, JSON.stringify(session)),
  clear: () => remove(HOST_KEY),
};

/** How many of this seat's secrets the player has already dismissed. */
export const seenSecrets = {
  get(seatKey: string): number {
    const n = Number(read(`${seatKey}:seen`));
    return Number.isInteger(n) && n > 0 ? n : 0;
  },
  set: (seatKey: string, count: number) => write(`${seatKey}:seen`, String(count)),
};

/** The TV herald's mute switch and chosen voice. */
export const heraldPrefs = {
  get(): { muted: boolean; voiceURI: string | null } {
    return {
      muted: read('partybox:herald:muted') === '1',
      voiceURI: read('partybox:herald:voice'),
    };
  },
  setMuted: (muted: boolean) => write('partybox:herald:muted', muted ? '1' : '0'),
  setVoice: (uri: string | null) =>
    uri ? write('partybox:herald:voice', uri) : remove('partybox:herald:voice'),
};
