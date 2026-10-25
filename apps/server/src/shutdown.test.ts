import { describe, expect, it } from 'vitest';
import { ok, startTestServer } from './test-support.js';

describe('shutdown', () => {
  it('warns clients, refuses new rooms while draining, then closes every socket', async () => {
    const s = await startTestServer({ devTools: false });
    const tv = await s.client();
    const phone = await s.client();
    await ok(tv.emitWithAck('room:create', {}));
    const notices = [tv, phone].map((c) => new Promise<void>((r) => c.once('server:shutdown', r)));
    const closed = [tv, phone].map((c) => new Promise((r) => c.once('disconnect', r)));

    const stopping = s.server.shutdown(200);
    await Promise.all(notices);
    expect(await phone.emitWithAck('room:create', {})).toMatchObject({
      ok: false,
      error: { code: 'shutting_down' },
    });
    await stopping;
    await expect(Promise.all(closed)).resolves.toHaveLength(2);
    expect(s.server.httpServer.listening).toBe(false);
  });
});
