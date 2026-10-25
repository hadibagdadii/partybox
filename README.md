# Partybox

Jackbox-style party games: a TV runs `/host`, players join on their phones at `/play`.

## Setup

Requires Node 22+ and pnpm 9 (`npm install -g pnpm@9`).

```bash
pnpm install
pnpm dev        # server on :3000, web on :5173 (open http://localhost:5173)
```

## Scripts

| Script           | What it does                                          |
| ---------------- | ----------------------------------------------------- |
| `pnpm dev`       | Runs server and Vite together; Vite proxies to server |
| `pnpm build`     | Builds all packages and the web app                   |
| `pnpm start`     | Production server on :3000, serving the built web app |
| `pnpm test`      | Vitest across all packages                            |
| `pnpm typecheck` | `tsc -b` over all project references                  |
| `pnpm lint`      | ESLint + Prettier check                               |

## Layout

- `apps/server` – Express + Socket.IO, authoritative game server
- `apps/web` – React + Vite + Tailwind (`/`, `/host`, `/play`)
- `packages/shared` – socket event types, zod schemas, `GameModule` interface, room codes
- `packages/games/diwan` – Diwan rules engine (CC BY-NC-SA 4.0, see its LICENSE)
- `packages/games/tap-race` – dummy game (first tap wins) that exercises the room plumbing

## Testing many players on one laptop

In dev, the host lobby has an **Add bot** button, and `/dev?code=ABCD&n=7` opens seven phone
views side by side. Each iframe loads `/play?slot=N`, which stores its reconnect token under
`partybox:ABCD:slotN` so the iframes get separate seats.

To join from real phones on your Wi-Fi, open the TV at your LAN address (Vite prints it as
`Network:`), or set `VITE_PUBLIC_URL` so the join link on the TV points there.
