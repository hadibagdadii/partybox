import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@partybox/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './test-support.js';

let server: TestServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

const errorCode = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? 'ok' : result.error!.code;

describe('abuse limits', () => {
  it('caps rooms per IP at 3, then rate limits creation after 10 tries', async () => {
    server = await startTestServer({ devTools: false });
    const tv = await server.client();
    const results = [];
    for (let i = 0; i < 11; i++) results.push(errorCode(await tv.emitWithAck('room:create', {})));
    expect(results).toEqual([
      ...Array(3).fill('ok'),
      ...Array(7).fill('too_many_rooms'),
      'rate_limited',
    ]);
  });

  it('rate limits join attempts after 30 a minute, so codes cannot be guessed quickly', async () => {
    server = await startTestServer({ devTools: false });
    const phone = await server.client();
    const code = ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH);
    const results = [];
    for (let i = 0; i < 31; i++) {
      results.push(errorCode(await phone.emitWithAck('room:join', { code, name: `P${i}` })));
    }
    expect(results.slice(0, 30)).toEqual(Array(30).fill('room_not_found'));
    expect(results[30]).toBe('rate_limited');
  });
});
