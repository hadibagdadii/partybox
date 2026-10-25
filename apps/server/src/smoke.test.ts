import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { playFullGame } from './smoke.js';
import { startTestServer, type TestServer } from './test-support.js';

let server: TestServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe('playFullGame', () => {
  it('drives 5 phones to a winner on a production server with no bots', async () => {
    const { config } = loadConfig({ NODE_ENV: 'production' });
    server = await startTestServer({ ...config, port: 0 });
    const result = await playFullGame(server.url, { seed: 11 });
    expect(['loyal', 'rebel']).toContain(result.winner);
    expect(result.actions).toBeGreaterThan(10);
  }, 30_000);
});
