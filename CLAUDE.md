# Partybox

Jackbox-style party game platform. A TV (host screen) shows the shared game; players join on phones with a 4-letter room code. First game: Diwan, a medieval Muslim court reskin of Secret Hitler.

## Stack

- pnpm workspaces monorepo, TypeScript strict everywhere
- apps/server: Node 22 LTS, Express, Socket.IO
- apps/web: React 18 + Vite + Tailwind, routes `/` (landing), `/host` (TV), `/play` (phone)
- packages/shared: socket event types and zod schemas shared by client and server
- packages/games/diwan: pure rules engine, no I/O, no sockets, no Date.now, no Math.random
- Tests: vitest. Lint: eslint + prettier.

## Architecture rules

- Server is authoritative. Clients send intents; the server validates and broadcasts state.
- Game engines are pure reducers: `reduce(state, action, rng) -> { state, events }`. Randomness comes from an injected seeded RNG so games are replayable in tests.
- Never send full game state to any client. Every broadcast goes through a view projection:
  - `getHostView(state)` contains only public information. It must never include roles, deck order, or hands.
  - `getPlayerView(state, playerId)` adds only what that player is allowed to know.
- Every game implements the `GameModule` interface in packages/shared so new games plug into the same room system.
- Validate every incoming socket payload with zod. Reject actions from the wrong player or wrong phase with a typed error, never by crashing.
- Rooms live in memory (Map) with a 2 hour idle TTL. Keep storage behind an interface so Redis can replace it later.

## Diwan theme

All player-facing strings come from packages/games/diwan/src/theme.ts. Never hardcode team, role, or decree names in components or engine logic. Engine uses neutral ids: `loyal`, `rebel`, `usurper`, `ameer`, `wazir`.

## License

Diwan adapts Secret Hitler (Max Temkin, Mike Boxleiter, Tommy Maranges, Mackenzie Schubert), licensed CC BY-NC-SA 4.0. Diwan must stay free, show attribution on the About screen, and ship under the same license (packages/games/diwan/LICENSE). Use only original art.

## Working agreement

- Plan before coding; list files you'll touch.
- Write or update tests with every engine change. Run `pnpm test` and `pnpm typecheck` before saying a task is done.
- Small commits with clear messages.
- Phones are the primary player device: design player UI mobile-first, large tap targets, works in portrait.
