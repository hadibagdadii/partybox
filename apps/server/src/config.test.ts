import { describe, expect, it } from 'vitest';
import { DEFAULT_LIMITS, loadConfig } from './config.js';

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

  it('raises the room cap and rate limits in development only', () => {
    const dev = loadConfig({}).config;
    expect(dev.maxRoomsPerIp).toBe(1000);
    expect(dev.limits.createRoom.max).toBeGreaterThanOrEqual(1000);
    expect(dev.limits.join.max).toBeGreaterThanOrEqual(5000);
    expect(loadConfig({ MAX_ROOMS_PER_IP: '4' }).config.maxRoomsPerIp).toBe(4);
    const prod = loadConfig({ NODE_ENV: 'production' }).config;
    expect(prod.maxRoomsPerIp).toBe(3);
    expect(prod.limits).toEqual(DEFAULT_LIMITS);
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
      clientIpHeader: undefined,
      allowedOrigin: undefined,
      webDist: '/srv/web',
      joinDisplayUrl: undefined,
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
      CLIENT_IP_HEADER: ' CF-Connecting-IP ',
    });
    expect(config).toMatchObject({
      allowedOrigin: 'https://diwan.example.com',
      maxRooms: 50,
      maxRoomsPerIp: 5,
      trustProxyHops: 2,
      clientIpHeader: 'cf-connecting-ip',
    });
  });

  it('reads JOIN_DISPLAY_URL at runtime, trimmed, and treats blank as unset', () => {
    expect(loadConfig({ JOIN_DISPLAY_URL: ' partybox.fun/ ' }).config.joinDisplayUrl).toBe(
      'partybox.fun',
    );
    expect(loadConfig({ JOIN_DISPLAY_URL: '  ' }).config.joinDisplayUrl).toBeUndefined();
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

  it('always offers Cambio in dev, and in production only when ENABLE_CAMBIO turns it on', () => {
    expect(loadConfig({}).config.enableCambio).toBe(true);
    expect(loadConfig({ ENABLE_CAMBIO: 'false' }).config.enableCambio).toBe(true);
    const prod = (value?: string) => loadConfig({ NODE_ENV: 'production', ENABLE_CAMBIO: value });
    expect(prod().config.enableCambio).toBe(false);
    expect(prod('').config.enableCambio).toBe(false);
    expect(prod('false').config.enableCambio).toBe(false);
    expect(prod('true').config.enableCambio).toBe(true);
    expect(prod(' TRUE ').config.enableCambio).toBe(true);
    expect(prod('1').config.enableCambio).toBe(true);
    const junk = prod('yes please');
    expect(junk.config.enableCambio).toBe(false);
    expect(junk.warnings).toEqual(['ENABLE_CAMBIO must be true or false; leaving it off']);
  });
});
