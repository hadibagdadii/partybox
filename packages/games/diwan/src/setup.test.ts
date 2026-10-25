import { createRng } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
import { createInitialState } from './setup.js';
import { knownRoles } from './views.js';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

const EXPECTED_SPLIT: Record<number, [loyal: number, rebel: number]> = {
  5: [3, 2],
  6: [4, 2],
  7: [4, 3],
  8: [5, 3],
  9: [5, 4],
  10: [6, 4],
};

describe('setup', () => {
  for (const [countStr, [loyal, rebel]] of Object.entries(EXPECTED_SPLIT)) {
    const count = Number(countStr);

    it(`${count} players: ${loyal} loyal / ${rebel} rebel including one Usurper`, () => {
      for (let seed = 0; seed < 20; seed++) {
        const s = createInitialState(seats(count), createRng(seed));
        const roles = s.players.map((p) => p.role);
        expect(roles.filter((r) => r === 'loyal')).toHaveLength(loyal);
        expect(roles.filter((r) => r === 'rebel')).toHaveLength(rebel - 1);
        expect(roles.filter((r) => r === 'usurper')).toHaveLength(1);
      }
    });

    it(`${count} players: knowledge rules`, () => {
      const s = createInitialState(seats(count), createRng(count));
      const rebelIds = s.players.filter((p) => p.role !== 'loyal').map((p) => p.id);
      for (const p of s.players) {
        const known = knownRoles(s, p.id);
        expect(known[p.id]).toBe(p.role);
        if (p.role === 'loyal') {
          expect(Object.keys(known)).toEqual([p.id]);
        } else if (p.role === 'rebel') {
          expect(Object.keys(known).sort()).toEqual([...rebelIds].sort());
          for (const id of rebelIds)
            expect(known[id]).toBe(s.players.find((x) => x.id === id)?.role);
        } else if (count <= 6) {
          expect(Object.keys(known).sort()).toEqual([...rebelIds].sort());
        } else {
          expect(Object.keys(known)).toEqual([p.id]);
        }
      }
    });
  }

  it('shuffles a 6 loyal / 11 rebel deck', () => {
    const s = createInitialState(seats(5), createRng(3));
    expect(s.draw).toHaveLength(17);
    expect(s.draw.filter((d) => d === 'loyal')).toHaveLength(6);
    expect(s.discard).toEqual([]);
  });

  it('starts at nomination with a random Ameer', () => {
    const firstAmeers = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      const s = createInitialState(seats(7), createRng(seed));
      expect(s.phase).toBe('nominate');
      expect(s.ameerId).toBe(s.players[s.rotationSeat]?.id);
      firstAmeers.add(s.ameerId);
    }
    expect(firstAmeers.size).toBeGreaterThan(3);
  });

  it('is deterministic for a seed', () => {
    expect(createInitialState(seats(8), createRng(42))).toEqual(
      createInitialState(seats(8), createRng(42)),
    );
  });

  it('rejects player counts outside 5-10', () => {
    expect(() => createInitialState(seats(4), createRng(1))).toThrow();
    expect(() => createInitialState(seats(11), createRng(1))).toThrow();
  });
});
