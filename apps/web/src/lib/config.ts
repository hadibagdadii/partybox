import { useEffect, useState } from 'react';

interface PublicConfig {
  joinDisplayUrl: string | null;
  /** Ids of the games the server offers; null until known (or if the server is unreachable). */
  games: string[] | null;
}

let cached: Promise<PublicConfig> | null = null;

function loadConfig(): Promise<PublicConfig> {
  cached ??= fetch('/api/config')
    .then((res): Promise<Partial<PublicConfig>> | Partial<PublicConfig> =>
      res.ok ? (res.json() as Promise<Partial<PublicConfig>>) : {},
    )
    .then((body) => ({
      joinDisplayUrl: typeof body.joinDisplayUrl === 'string' ? body.joinDisplayUrl : null,
      games:
        Array.isArray(body.games) && body.games.every((g) => typeof g === 'string')
          ? body.games
          : null,
    }))
    .catch(() => {
      cached = null; // Try again next mount.
      return { joinDisplayUrl: null, games: null };
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

/** Game ids the server offers, from /api/config; null until it answers. */
export function useEnabledGames(): string[] | null {
  const [games, setGames] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadConfig().then((c) => live && setGames(c.games));
    return () => {
      live = false;
    };
  }, []);
  return games;
}
