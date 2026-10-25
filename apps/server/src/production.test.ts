import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@partybox/shared';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { io as connect } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { ok, record, startTestServer, until, type TestServer } from './test-support.js';

let server: TestServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** Production settings, with the bot env vars set to prove they're ignored. */
async function startProd(extra: Record<string, string> = {}) {
  const webDist = mkdtempSync(path.join(tmpdir(), 'partybox-web-'));
  writeFileSync(path.join(webDist, 'index.html'), '<div id="root"></div>');
  const { config } = loadConfig({
    NODE_ENV: 'production',
    BOT_MIN_DELAY_MS: '0',
    BOT_MAX_DELAY_MS: '0',
    WEB_DIST: webDist,
    ...extra,
  });
  server = await startTestServer({ ...config, port: 0 });
  return server;
}

describe('production server', () => {
  it('turns off bots, dev events, and Tap Race', async () => {
    const s = await startProd();
    const tv = await s.client();
    const log = record(tv);
    await ok(tv.emitWithAck('room:create', {}));
    await until(() => log.host.length > 0);
    expect(log.host.at(-1)!.games.map((g) => g.id)).toEqual(['diwan']);
    for (const event of ['dev:addBot', 'dev:start'] as const) {
      expect(await tv.emitWithAck(event, {})).toMatchObject({
        ok: false,
        error: { code: 'dev_only' },
      });
    }
    expect(await tv.emitWithAck('room:setGame', { gameId: 'tap-race' })).toMatchObject({
      ok: false,
      error: { code: 'unknown_game' },
    });
    expect(await tv.emitWithAck('room:create', { gameId: 'tap-race' })).toMatchObject({
      ok: false,
      error: { code: 'unknown_game' },
    });
  });

  it('serves /healthz and the app on one port with a CSP that only allows Google Fonts', async () => {
    const s = await startProd();
    const health = await fetch(`${s.url}/healthz`);
    expect(await health.json()).toEqual({ ok: true });
    for (const route of ['/host', '/play']) {
      const res = await fetch(`${s.url}${route}`);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('id="root"');
    }
    const csp = health.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    const external = csp.match(/https?:\/\/[^\s;]+/g) ?? [];
    expect([...new Set(external)].sort()).toEqual([
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ]);
    expect(health.headers.get('x-powered-by')).toBeNull();
  });

  it('drops a socket that sends more than 16 KB', async () => {
    const s = await startProd();
    const tv = await s.client();
    const gone = new Promise((resolve) => tv.once('disconnect', resolve));
    const code = ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH);
    tv.emit('room:join', { code, name: 'x'.repeat(20_000) }, () => undefined);
    await expect(gone).resolves.toBeDefined();
  });

  it('refuses browser handshakes from other origins', async () => {
    const s = await startProd({ ALLOWED_ORIGIN: 'https://diwan.example.com' });
    const tryOrigin = (origin: string) =>
      new Promise<boolean>((resolve) => {
        const socket = connect(s.url, {
          transports: ['websocket'],
          forceNew: true,
          reconnection: false,
          extraHeaders: { origin },
        });
        socket.once('connect', () => (socket.disconnect(), resolve(true)));
        socket.once('connect_error', () => (socket.disconnect(), resolve(false)));
      });
    expect(await tryOrigin('https://evil.example')).toBe(false);
    expect(await tryOrigin('https://diwan.example.com')).toBe(true);
    expect(await tryOrigin(s.url)).toBe(true);
  });
});
