import { afterEach, describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';
import { playFullGame } from './smoke.js';
import { startTestServer, type TestServer } from './test-support.js';

let server: TestServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

const NAMES = ['Qamar', 'Idris', 'Safiyya', 'Yunus', 'Ruqayya'];

describe('server logs', () => {
  it('record a game without player names, tokens, ids, or roles', async () => {
    const lines: string[] = [];
    const logger = createLogger({ write: (line: string) => void lines.push(line) });
    server = await startTestServer({ devTools: false, logger });
    const result = await playFullGame(server.url, { names: NAMES, seed: 3 });
    const entries = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    const output = lines.join('\n');

    expect(entries.map((e) => e.message)).toEqual(['room_created', 'game_started', 'game_ended']);
    expect(entries[0]).toMatchObject({ code: result.code, gameId: 'diwan' });
    expect(entries[0]!.ipHash).toMatch(/^[0-9a-f]{10}$/);
    expect(entries[1]).toMatchObject({ code: result.code, players: 5 });
    expect(entries[2]).toMatchObject({ code: result.code, winner: result.winner });
    expect(['loyal', 'rebel']).toContain(entries[2]!.winner);

    const { hostToken, playerIds, playerTokens } = result.secrets;
    for (const secret of [...NAMES, hostToken, ...playerIds, ...playerTokens]) {
      expect(output).not.toContain(secret);
    }
    expect(output).not.toMatch(/127\.0\.0\.1|::1/);
    // The winning team is the only team or role word allowed, and only as `winner`.
    const withoutWinner = lines.map((l) => l.replace(/"winner":"(loyal|rebel)"/, ''));
    expect(withoutWinner.join('\n')).not.toMatch(/loyal|rebel|usurper|ameer|wazir/i);
  }, 30_000);
});
