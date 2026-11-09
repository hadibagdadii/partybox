import type { ReflexOutcome } from './rooms/bot-runner.js';

export interface Limit {
  max: number;
  windowMs: number;
}

export interface ServerConfig {
  isProd: boolean;
  port: number;
  /** Dev-only socket events, bots, and Tap Race. Always off in production. */
  devTools: boolean;
  /** Offers Cambio in the game picker. Always on in dev; production needs ENABLE_CAMBIO=true. */
  enableCambio: boolean;
  /** Bot timing and seed; tests set the delays to 0. Ignored without dev tools. */
  bots:
    | {
        minDelayMs?: number | undefined;
        maxDelayMs?: number | undefined;
        seed?: number;
        /** Test hook: every out-of-turn bot move and its result. */
        onReflex?: (outcome: ReflexOutcome) => void;
      }
    | undefined;
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
  /** Short join address the TV shows as text (e.g. partybox.fun). Display only. */
  joinDisplayUrl: string | undefined;
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

/**
 * Dev only: high enough that repeated local test runs (many rooms, many joins from one IP)
 * never hit them. Production always uses `DEFAULT_LIMITS`.
 */
export const DEV_LIMITS: ServerConfig['limits'] = {
  createRoom: { max: 1000, windowMs: 10 * 60 * 1000 },
  join: { max: 5000, windowMs: 60 * 1000 },
};
export const DEV_MAX_ROOMS_PER_IP = 1000;

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

  const flag = (key: string): boolean => {
    const raw = env[key]?.trim().toLowerCase();
    if (raw === undefined || raw === '' || raw === 'false' || raw === '0') return false;
    if (raw === 'true' || raw === '1') return true;
    warnings.push(`${key} must be true or false; leaving it off`);
    return false;
  };

  return {
    warnings,
    config: {
      isProd,
      port: int('PORT', 3000, 1),
      devTools: !isProd,
      enableCambio: isProd ? flag('ENABLE_CAMBIO') : true,
      bots: isProd
        ? undefined
        : { minDelayMs: botMs('BOT_MIN_DELAY_MS'), maxDelayMs: botMs('BOT_MAX_DELAY_MS') },
      allowedOrigin: env.ALLOWED_ORIGIN?.trim().replace(/\/+$/, '') || undefined,
      maxRooms: int('MAX_ROOMS', 200, 1),
      maxRoomsPerIp: int('MAX_ROOMS_PER_IP', isProd ? 3 : DEV_MAX_ROOMS_PER_IP, 1),
      trustProxyHops: int('TRUST_PROXY_HOPS', isProd ? 1 : 0),
      clientIpHeader: env.CLIENT_IP_HEADER?.trim().toLowerCase() || undefined,
      limits: isProd ? DEFAULT_LIMITS : DEV_LIMITS,
      // In dev, Vite serves the web app and proxies /healthz and /socket.io here.
      webDist: isProd ? (env.WEB_DIST ?? defaults.webDist) : undefined,
      joinDisplayUrl: env.JOIN_DISPLAY_URL?.trim().replace(/\/+$/, '') || undefined,
    },
  };
}
