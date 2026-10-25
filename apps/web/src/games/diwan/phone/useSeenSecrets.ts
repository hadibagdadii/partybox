import type { Secret } from '@partybox/diwan';
import { useCallback, useEffect, useState } from 'react';
import { seenSecrets } from '../../../lib/storage';

type SpySecret = Extract<Secret, { type: 'investigate' }>;

/**
 * A Spy result arrives after the phase has already moved on, so the phone shows it
 * as an overlay until the player taps Done. The dismissed count survives refreshes.
 */
export function useSeenSecrets(
  seatKey: string,
  secrets: Secret[],
): { unseenSpy: SpySecret | null; markSeen: () => void } {
  const [seen, setSeen] = useState(() => seenSecrets.get(seatKey));

  // A new game starts with no secrets; forget the last game's count.
  useEffect(() => {
    if (secrets.length < seen) {
      setSeen(secrets.length);
      seenSecrets.set(seatKey, secrets.length);
    }
  }, [secrets.length, seen, seatKey]);

  const index = secrets.findIndex((s, i) => i >= seen && s.type === 'investigate');
  const unseenSpy = index === -1 ? null : (secrets[index] as SpySecret);

  const markSeen = useCallback(() => {
    const next = index === -1 ? secrets.length : index + 1;
    setSeen(next);
    seenSecrets.set(seatKey, next);
  }, [index, secrets.length, seatKey]);

  return { unseenSpy, markSeen };
}
