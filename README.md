# Paper Aces

A two-pilot WWI dogfight played one page at a time, inspired by the picture-book dogfight games of the early 1980s. All artwork is drawn live in the browser; no book scans are used.

## Play
- **Versus a rookie / an ace** — fight a computer pilot.
- **Two pilots, one screen** — pass-and-play; a curtain hides each pilot's choice.
- **Fly online** — one player presses **Host a game** and gets a four-letter code (and a share link). The other player types the code and presses **Join**. The host flies Blue, the joiner flies Red. Moves stay secret on the server until both are in, then the server flies the turn. A player who reloads can press **Rejoin game**. Either player can call a rematch when the duel ends.

Keyboard: `Q W E R T` / `A S D F G` select the ten maneuvers, `Enter` flies.

## Deploy to Vercel
No build step and no npm packages.

1. Push this folder to a GitHub repo and import it in Vercel (Framework Preset: **Other**, no build command), or run `vercel --prod` inside the folder.
2. Online play needs the Upstash Redis integration on the project. The API reads either `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL` + `KV_REST_API_TOKEN` (including names with a custom prefix such as `STORAGE_KV_REST_API_URL`). Redeploy after connecting the database so the function picks up the variables.

## How online play is stored
| Key | Holds | Expires |
|---|---|---|
| `pa:g:CODE` | Game state: positions, damage, log, and the two players' secret tokens | 3 h after last write |
| `pa:p:CODE` | This turn's hidden picks (`turn:seat` → maneuver) | 3 h |
| `pa:j:CODE` | Claim on the second seat, so only one person can join | 3 h |
| `pa:l:CODE:TURN` | Short lock so only one request resolves a turn | 20 s |

Clients poll `/api/game` every 1.5 s while waiting and every 3 s otherwise (8 s in a background tab). Each poll is one Upstash request with two commands. A 20-minute game uses roughly 2,000–3,000 commands, well inside Upstash's free daily allowance for casual play.

## Files
- `index.html` — page, cockpit renderer, local modes, online client.
- `rules.js` — flight rules and computer pilot, shared by the browser and the API.
- `api/game.js` — Vercel function: create, join, state, pick, rematch.
- `vercel.json` — clean URLs, no stale caching.
