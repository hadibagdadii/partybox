# Deploying Partybox to Railway

Partybox deploys as **one Railway service** built from the `Dockerfile`. One port serves the web app (`/`, `/host`, `/play`, `/about`), `/healthz`, and Socket.IO.

## Before you start: one instance only

Rooms live in the server's memory. That means:

- The service must run **exactly one replica**. With two, a TV and a phone can land on different instances and never find each other's room.
- **Any redeploy or restart ends every game in progress.** On shutdown the server tells connected clients it is going away, closes their sockets, and exits; the rooms are gone. Don't deploy during game night.

`railway.json` in the repo already sets 1 replica, the `/healthz` health check, 10 s of draining, and no overlap. The dashboard steps below set the same things, so check they match.

## 1. Create the service

1. Push this repo to GitHub (`hadibagdadii/partybox`).
2. In Railway: **New Project → Deploy from GitHub repo**, pick the repo, and allow access if asked.
3. Railway detects `railway.json` and the `Dockerfile` and starts building. The first build takes a few minutes.

## 2. Set variables

Service → **Variables**:

| Variable           | Value                                     | Required                                                                                                           |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`         | `production`                              | Yes. Turns off dev tools, bots, and Tap Race, whatever else is set.                                                |
| `ALLOWED_ORIGIN`   | `https://your-domain` (no trailing slash) | Yes once you have a domain (step 4). The site's own origin always works; this allows that exact origin explicitly. |
| `MAX_ROOMS`        | default `200`                             | Optional. Rooms open at once across everyone.                                                                      |
| `MAX_ROOMS_PER_IP` | default `3`                               | Optional. Rooms one network can hold open.                                                                         |
| `TRUST_PROXY_HOPS` | default `1`                               | Optional. Proxies in front of the app whose `X-Forwarded-For` entry is trusted. See step 5.                        |

Don't set `PORT`: Railway injects it and the server listens on it. Don't set `BOT_MIN_DELAY_MS` / `BOT_MAX_DELAY_MS`: they're ignored in production anyway.

Saving variables triggers a redeploy.

## 3. Deploy settings

Service → **Settings → Deploy**:

- **Replicas**: `1`, in a single region.
- **Healthcheck Path**: `/healthz` (returns `{"ok":true}`).
- **Restart policy**: On failure.
- **Teardown**: overlap `0` s, draining `10` s. The server needs about 2 s to warn clients and close; draining gives it room before Railway force-kills it.

## 4. Domains

Service → **Settings → Networking**:

1. **Generate Domain**. If asked for a port, use the one the deploy logs print in `server_started` (it's Railway's `PORT`). You get `https://<name>.up.railway.app`.
2. Set `ALLOWED_ORIGIN` to that URL and let it redeploy.
3. Optional custom domain: **Custom Domain**, enter e.g. `diwan.example.com`, then add the CNAME record Railway shows at your DNS provider. Wait until Railway shows the certificate as issued, then change `ALLOWED_ORIGIN` to `https://diwan.example.com`.

## 5. Post-deploy checks

1. `https://<domain>/healthz` shows `{"ok":true}`.
2. `https://<domain>/host` shows the host screen, and `/play` shows the join form.
3. **Proxy check** (rate limits and room caps depend on it): create one room from your home Wi-Fi and another from a phone on cellular data (Wi-Fi off). In the logs, find the two `room_created` lines and compare their `ipHash` values.
   - Different hashes: the server sees real client IPs. Done.
   - Same hash: the server is seeing a proxy's address instead of the client. Change `TRUST_PROXY_HOPS` (try `2`), redeploy, and repeat.

   Hashes are salted per process, so compare two lines from the same deployment.

## Reading logs

Logs are one JSON line per event, with `level`, `message`, and fields. They never contain player names, tokens, roles, or raw IPs.

- Dashboard: service → **Deployments** → a deployment → **View Logs** (or **Observability → Logs**). Search for a message such as `game_ended`, or filter on a field, e.g. `@code:ABCD` or `@level:warn`.
- CLI: `npm i -g @railway/cli`, then `railway login`, `railway link`, `railway logs`.

| message                              | Meaning                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `server_started`                     | Up and listening; shows port and env. `devTools` must be `false`.                          |
| `room_created`                       | Room code, game, and `ipHash` of the creator.                                              |
| `game_started` / `game_ended`        | Room code, player count / winning team (`winner: null, endedBy: host` if the TV ended it). |
| `rate_limit_hit`                     | Someone hit 10 rooms per 10 min, or 30 join attempts per minute.                           |
| `room_cap_hit`                       | `MAX_ROOMS` or `MAX_ROOMS_PER_IP` reached.                                                 |
| `rooms_expired`                      | Rooms idle for 2 hours were removed.                                                       |
| `server_stopping` / `server_stopped` | Clean shutdown on redeploy.                                                                |
| `error`                              | Something threw; includes the error and stack.                                             |

## Game night checklist

- Open the site a few minutes early. This confirms it's up and wakes anything that was idle.
- Open `/host` on the TV laptop and press **Create room**.
- Tap **Enable the herald** (browsers block speech until someone taps).
- Share the join link shown on the TV (`/play?code=XXXX`), or have people type the 4-letter code.
- Don't deploy or change variables until the night is over: a redeploy ends every game.

## Running the image locally

```bash
docker build -t partybox .
```

```bash
docker run --rm -p 8080:8080 -e NODE_ENV=production partybox
```

Then open http://localhost:8080/host. To play a full 5-phone game against it without bots:

```bash
pnpm --filter @partybox/server smoke http://localhost:8080
```

`docker stop` needs more than the 1.5 s shutdown notice; if your Docker's default stop timeout is shorter, use `docker stop -t 10 <container>`.
