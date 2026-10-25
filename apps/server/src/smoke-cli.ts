import { playFullGame } from './smoke.js';

// Usage: pnpm --filter @partybox/server smoke [url] [seed]
const url = process.argv[2] ?? 'http://localhost:8080';
const seed = Number(process.argv[3] ?? 1);
const { code, winner, actions } = await playFullGame(url, { seed });
console.log(JSON.stringify({ url, code, winner, actions }));
