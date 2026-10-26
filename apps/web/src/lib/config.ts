import { useEffect, useState } from 'react';

interface PublicConfig {
  joinDisplayUrl: string | null;
}

let cached: Promise<PublicConfig> | null = null;

function loadConfig(): Promise<PublicConfig> {
  cached ??= fetch('/api/config')
    .then((res): Promise<Partial<PublicConfig>> | Partial<PublicConfig> =>
      res.ok ? (res.json() as Promise<Partial<PublicConfig>>) : {},
    )
    .then((body) => ({
      joinDisplayUrl: typeof body.joinDisplayUrl === 'string' ? body.joinDisplayUrl : null,
    }))
    .catch(() => {
      cached = null; // Try again next mount.
      return { joinDisplayUrl: null };
    });
  return cached;
}

/** Tests only: forget the fetched config. */
export function resetConfigCache() {
  cached = null;
}

/** JOIN_DISPLAY_URL from the server, read at runtime; null when unset or unreachable. */
export function useJoinDisplayUrl(): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void loadConfig().then((c) => live && setUrl(c.joinDisplayUrl));
    return () => {
      live = false;
    };
  }, []);
  return url;
}
