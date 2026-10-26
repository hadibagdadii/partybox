export interface Limit {
  max: number;
  windowMs: number;
}

export interface ServerConfig {
  isProd: boolean;
  port: number;
  /** Dev-only socket events, bots, and Tap Race. Always off in production. */
  devTools: boolean;
  /** Bot timing and seed; tests set the delays to 0. Ignored without dev tools. */
  bots: { minDelayMs?: number; maxDelayMs?: number; seed?: number } | undefined;
  /** Extra browser origin allowed to open sockets. Same-origin always works. */
  allowedOrigin: string | undefined;
  maxRooms: number;
  maxRoomsPerIp: number;
  /** Proxies in front of the server whose X-Forwarded-For entries we trust. */
  trustProxyHops: number;
  /** Lowercased header a proxy sets to the client IP (e.g. cf-connecting-ip); wins over hops. */
  clientIpHeader: string | undefined;
  limits: { createRoom: Limit; join: Limit };
  /** Built web app, served with SPA fallback when set. */
  webDist: string | undefined;
}

export interface LoadedConfig {
  config: ServerConfig;
  /** Env values that were ignored; logged once the logger exists. */
  warnings: string[];
}

export const DEFAULT_LIMITS: ServerConfig['limits'] = {
  createRoom: { max: 10, windowMs: 10 * 60 * 1000 },
  join: { max: 30, windowMs: 60 * 1000 },
};

type Env = Record<string, string | undefined>;

/** Reads settings from the environment. Production never enables dev tools, whatever else is set. */
export function loadConfig(env: Env, defaults: { webDist?: string } = {}): LoadedConfig {
  const warnings: string[] = [];
  const isProd = env.NODE_ENV === 'production';

  const int = (key: string, fallback: number, min = 0): number => {
    const raw = env[key];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= min) return n;
    warnings.push(`${key} must be an integer >= ${min}; using ${fallback}`);
    return fallback;
  };

  // Dev only: slow the bots down (e.g. to watch TV moments play out).
  const botMs = (key: string): number | undefined => {
    if (isProd || !env[key]) return undefined;
    const n = Number(env[key]);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  return {
    warnings,
    config: {
      isProd,
      port: int('PORT', 3000, 1),
      devTools: !isProd,
      bots: isProd
        ? undefined
        : { minDelayMs: botMs('BOT_MIN_DELAY_MS'), maxDelayMs: botMs('BOT_MAX_DELAY_MS') },
      allowedOrigin: env.ALLOWED_ORIGIN?.trim().replace(/\/+$/, '') || undefined,
      maxRooms: int('MAX_ROOMS', 200, 1),
      maxRoomsPerIp: int('MAX_ROOMS_PER_IP', 3, 1),
      trustProxyHops: int('TRUST_PROXY_HOPS', isProd ? 1 : 0),
      clientIpHeader: env.CLIENT_IP_HEADER?.trim().toLowerCase() || undefined,
      limits: DEFAULT_LIMITS,
      // In dev, Vite serves the web app and proxies /healthz and /socket.io here.
      webDist: isProd ? (env.WEB_DIST ?? defaults.webDist) : undefined,
    },
  };
}
