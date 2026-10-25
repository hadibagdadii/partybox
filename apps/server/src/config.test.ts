import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('keeps dev tools and bot timing off in production even when the env asks for them', () => {
    const { config } = loadConfig({
      NODE_ENV: 'production',
      BOT_MIN_DELAY_MS: '0',
      BOT_MAX_DELAY_MS: '5',
    });
    expect(config.isProd).toBe(true);
    expect(config.devTools).toBe(false);
    expect(config.bots).toBeUndefined();
  });

  it('honours bot timing in development', () => {
    const { config } = loadConfig({ BOT_MIN_DELAY_MS: '100', BOT_MAX_DELAY_MS: '200' });
    expect(config.devTools).toBe(true);
    expect(config.bots).toEqual({ minDelayMs: 100, maxDelayMs: 200 });
  });

  it('uses production defaults', () => {
    const { config, warnings } = loadConfig(
      { NODE_ENV: 'production', PORT: '8080' },
      { webDist: '/srv/web' },
    );
    expect(config).toMatchObject({
      port: 8080,
      maxRooms: 200,
      maxRoomsPerIp: 3,
      trustProxyHops: 1,
      allowedOrigin: undefined,
      webDist: '/srv/web',
    });
    expect(config.limits.createRoom).toEqual({ max: 10, windowMs: 600_000 });
    expect(config.limits.join).toEqual({ max: 30, windowMs: 60_000 });
    expect(warnings).toEqual([]);
  });

  it('reads overrides and trims a trailing slash off ALLOWED_ORIGIN', () => {
    const { config } = loadConfig({
      NODE_ENV: 'production',
      ALLOWED_ORIGIN: 'https://diwan.example.com/',
      MAX_ROOMS: '50',
      MAX_ROOMS_PER_IP: '5',
      TRUST_PROXY_HOPS: '2',
    });
    expect(config).toMatchObject({
      allowedOrigin: 'https://diwan.example.com',
      maxRooms: 50,
      maxRoomsPerIp: 5,
      trustProxyHops: 2,
    });
  });

  it('trusts no proxy in development, and allows 0 hops in production', () => {
    expect(loadConfig({}).config.trustProxyHops).toBe(0);
    expect(
      loadConfig({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '0' }).config.trustProxyHops,
    ).toBe(0);
  });

  it('falls back to defaults with a warning for bad numbers', () => {
    const { config, warnings } = loadConfig({
      NODE_ENV: 'production',
      TRUST_PROXY_HOPS: 'one',
      MAX_ROOMS: '-4',
    });
    expect(config.trustProxyHops).toBe(1);
    expect(config.maxRooms).toBe(200);
    expect(warnings).toHaveLength(2);
  });
});
