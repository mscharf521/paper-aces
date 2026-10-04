# Paper Aces

A two-pilot WWI dogfight played one cockpit page at a time. Both pilots pick a maneuver in secret; then each turns to the page that shows what they see. All artwork is drawn live in the browser.

Modes: versus a rookie or an ace (computer), same-screen pass-and-play, and **online** play between two devices using a four-letter code.

## Stack
- **Vite + React 19 + TypeScript**, routed with React Router
- **Vercel Function** at `api/game.ts` (Web-standard `POST` handler)
- **Upstash Redis** via `@upstash/redis` for online game state

```
api/game.ts              POST /api/game — thin HTTP wrapper
server/gameService.ts    create / join / state / pick / rematch / leave
server/redis.ts          Upstash client; finds the env vars Vercel added
server/memoryRedis.ts    in-memory stand-in used by `npm run dev` when no Upstash vars are set
shared/rules.ts          flight rules + computer pilot (used by client AND server)
shared/online.ts         API types, code format
src/main.tsx             router
src/routes/              Home, LocalGame, OnlineHub, OnlineGame (lobby + match), HowToPlay
src/components/          CockpitPage, ManeuverPicker, Panels, GameScreen, Overlay
src/render/              canvas drawing for the cockpit page and overhead map
src/hooks/useOnlineGame  polling + actions for an online match
src/lib/                 API client, saved-game tokens, captions
```

## Routes
| Path | Screen |
|---|---|
| `/` | Mode select |
| `/play/rookie`, `/play/ace`, `/play/local` | Offline duels |
| `/online` | Host a game, or join with a code |
| `/g/ABCD` | Lobby while waiting, then the match. Opening this link on a new device offers to join as Red. |
| `/how-to-play` | Rules |

## Online flow
1. **Host a game** → server creates a code and a secret token, saves both in Redis, and the host lands on `/g/CODE`, which shows the code and waits.
2. The other player enters the code (or opens the invite link) → server atomically claims the second seat and hands back a token.
3. The host's lobby notices within ~1.5 s and switches to the match.
4. Each turn, picks are stored hidden. When both are in, exactly one request resolves the turn (Redis lock) and both clients see the new page on their next poll.

Tokens live in `localStorage`, so a reload or rejoin from `/online` keeps your seat. Games expire 3 hours after the last move.

## Deploy on Vercel
1. Push this folder to GitHub and import it in Vercel (it detects Vite; build `npm run build`, output `dist`).
2. Make sure the Upstash Redis integration is connected to the project. The server accepts `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, or `KV_REST_API_URL` + `KV_REST_API_TOKEN`, including versions with a custom prefix.
3. Redeploy after connecting the database so the function sees the variables.

If online play says *"The game server has no database"*, the function can't see those variables: check they're enabled for the Production environment and redeploy.

## Run locally
```bash
npm install
npm run dev                  # http://localhost:5173 — /api runs inside Vite
```
With no Upstash variables set, the dev server keeps games in memory (they reset when it restarts). To use a real database locally, `cp .env.example .env.local` and paste your Upstash REST URL and token.

The package is `"type": "module"`, so relative imports under `api/`, `server/` and `shared/` need a `.js` extension (e.g. `"./errors.js"`) for the Vercel function to load.
`npm run build` type-checks and builds.

## Redis keys
| Key | Holds | Expires |
|---|---|---|
| `pa:g:CODE` | game record: duel state + both players' tokens | 3 h after last write |
| `pa:p:CODE` | hidden picks, field `turn:seat` | 3 h |
| `pa:j:CODE` | claim on the second seat | 3 h |
| `pa:l:CODE:TURN` | lock so one request resolves each turn | 20 s |

Polling is 1.5 s while waiting and 3 s otherwise (8 s in a background tab); each poll is one Upstash request with two commands. A 30-turn game used about 680 commands in testing.
